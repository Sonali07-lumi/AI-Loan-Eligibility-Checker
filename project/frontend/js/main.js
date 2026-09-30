/**
 * Shared across every page: header/nav/footer injection, the global
 * currency selector, small validation helpers, local "recent activity"
 * storage (used as a fallback / mirror of Google Sheets), the custom
 * cursor, and a toast helper.
 *
 * Exposes everything other page scripts need on window.Finova.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Add a currency here to make it selectable everywhere in the app.
  const CUR = {
    INR: ['₹', 'en-IN', 'Indian Rupee'],
    USD: ['$', 'en-US', 'US Dollar'],
    EUR: ['€', 'de-DE', 'Euro'],
    GBP: ['£', 'en-GB', 'British Pound'],
    JPY: ['¥', 'ja-JP', 'Japanese Yen'],
    AUD: ['A$', 'en-AU', 'Australian Dollar'],
    CAD: ['C$', 'en-CA', 'Canadian Dollar'],
    SGD: ['S$', 'en-SG', 'Singapore Dollar'],
    AED: ['د.إ', 'en-AE', 'UAE Dirham'],
    CHF: ['CHF', 'de-CH', 'Swiss Franc'],
  };

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } },
  };

  let cc = store.get('fin_cur', 'INR');
  if (!CUR[cc]) cc = 'INR';

  function fmt(n, c = cc) {
    return new Intl.NumberFormat((CUR[c] || CUR.INR)[1], { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- header / nav / footer -------------------------------------------
  const NAV = [
    ['index.html', 'Home'], ['dashboard.html', 'Dashboard'], ['loan.html', 'Loan'],
    ['credit.html', 'Credit'], ['emi.html', 'EMI'], ['tips.html', 'AI Tips'], ['about.html', 'About'],
  ];

  function currentPage() {
    const p = location.pathname.split('/').pop();
    return p || 'index.html';
  }

  function injectChrome() {
    const headerHost = $('#site-header');
    if (headerHost) {
      headerHost.innerHTML = `
        <div class="bar">
          <a class="logo" href="index.html" aria-label="FINOVA home">FIN<b>O</b>VA</a>
          <nav id="nav" aria-label="Main">
            ${NAV.map(([href, label]) => `<a href="${href}"${href === currentPage() ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')}
          </nav>
          <select id="cur-sel" aria-label="Currency"></select>
          <button id="menu" aria-expanded="false" aria-controls="nav" aria-label="Toggle navigation">☰</button>
        </div>`;
    }
    const footerHost = $('#site-footer');
    if (footerHost) {
      footerHost.innerHTML = `FINOVA — AI-powered financial decision support. This platform provides
        educational estimates and AI-generated financial insights. Results are not official loan
        approvals, credit-bureau scores, or professional financial advice.`;
    }
    if (!$('#toast')) {
      const t = document.createElement('div');
      t.id = 'toast'; t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    $('#cur-sel') && ($('#cur-sel').innerHTML = Object.entries(CUR).map(([c, [s, , n]]) => `<option value="${c}">${c} — ${n} (${s})</option>`).join(''));
    $('#menu') && ($('#menu').onclick = () => {
      const open = $('#nav').classList.toggle('open');
      $('#menu').setAttribute('aria-expanded', String(open));
    });
    $('#cur-sel') && ($('#cur-sel').onchange = (e) => setCurrency(e.target.value, true));
    applyCurrencyToDom(false);
  }

  function applyCurrencyToDom(clearInputs) {
    $('#cur-sel') && ($('#cur-sel').value = cc);
    $$('.cur').forEach((e) => (e.textContent = (CUR[cc] || CUR.INR)[0]));
    if (clearInputs) {
      $$('[data-m]').forEach((i) => { i.value = ''; const e = document.getElementById(i.id + '-e'); if (e) e.textContent = ''; });
      document.dispatchEvent(new CustomEvent('finova:currency-changed', { detail: { currency: cc } }));
    }
  }

  function setCurrency(c, userInitiated) {
    if (!CUR[c]) return;
    const hadValues = userInitiated && $$('[data-m]').some((i) => i.value);
    cc = c;
    store.set('fin_cur', c);
    applyCurrencyToDom(!!userInitiated);
    if (userInitiated && hadValues) {
      toast(`Currency set to ${c}. Amount fields were cleared — enter amounts in ${c}.`);
    }
  }

  // ---- toast --------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.textContent = ''; }, 4500);
  }

  // ---- validation helpers ---------------------------------------------
  function validateNumber(id, opts = {}) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(id + '-e');
    const raw = el.value.replace(/[,\s]/g, '');
    const lo = opts.min ?? 0;
    const hi = opts.max ?? Infinity;
    let msg = '';
    let value = '';
    if (!raw) {
      if (opts.required !== false) msg = 'Please enter ' + (opts.name || 'a value') + '.';
    } else if (!/^\d+(\.\d+)?$/.test(raw)) {
      msg = 'Enter a valid positive number.';
    } else {
      value = Number(raw);
      if (opts.integer && !Number.isInteger(value)) msg = 'Use a whole number.';
      else if (opts.greaterThanZero && value <= 0) msg = 'Must be greater than zero.';
      else if (value < lo || value > hi) msg = `Enter a value between ${lo} and ${hi === Infinity ? 'a realistic amount' : hi}.`;
      else if (value > 1e12) msg = 'That number is too large.';
    }
    if (errEl) errEl.textContent = msg;
    el.setAttribute('aria-invalid', String(!!msg));
    return msg ? null : value;
  }

  function validateSelect(id, name) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(id + '-e');
    const msg = el.value ? '' : 'Please select ' + name + '.';
    if (errEl) errEl.textContent = msg;
    el.setAttribute('aria-invalid', String(!!msg));
    return msg ? null : el.value;
  }

  function validateText(id, opts = {}) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(id + '-e');
    const v = el.value.trim();
    const msg = v ? '' : 'Please enter ' + (opts.name || 'this field') + '.';
    if (errEl) errEl.textContent = msg;
    el.setAttribute('aria-invalid', String(!!msg));
    return msg ? null : v;
  }

  function buildMoneyField(container, id, label, placeholder) {
    container.className = 'field';
    container.innerHTML = `<label for="${id}">${label}</label>
      <div class="in money"><span class="cur" aria-hidden="true">${(CUR[cc] || CUR.INR)[0]}</span>
      <input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${placeholder}" data-m></div>
      <p class="err" id="${id}-e" role="alert"></p>`;
  }

  function buildNumberField(container, id, label, placeholder) {
    container.className = 'field';
    container.innerHTML = `<label for="${id}">${label}</label>
      <div class="in"><input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${placeholder}"></div>
      <p class="err" id="${id}-e" role="alert"></p>`;
  }

  function buildFieldsFromData() {
    $$('[data-f]').forEach((d) => {
      const [id, label, placeholder, type] = d.dataset.f.split('|');
      if (type === 'm') buildMoneyField(d, id, label, placeholder);
      else buildNumberField(d, id, label, placeholder);
    });
  }

  // ---- recent activity (local mirror; also posted to backend if configured) --
  function recordLocal(tool, summary, vals) {
    const r = store.get('fin_recent', []);
    r.unshift({ tool, cur: cc, ts: Date.now(), summary, vals });
    store.set('fin_recent', r.slice(0, 20));
  }

  async function saveRecord(tool, summary, vals, aiSummary) {
    recordLocal(tool, summary, vals);
    if (window.FinovaAPI) {
      try {
        await window.FinovaAPI.saveRecord({
          tool, currency: cc, inputs: vals, result_summary: String(summary), ai_summary: aiSummary || null,
        });
      } catch (e) { /* local record already kept; backend save is best-effort */ }
    }
  }

  // ---- custom cursor (desktop, motion allowed) --------------------------
  function initCursor() {
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    document.body.classList.add('cc');
    ['cd', 'cg', 'cr'].forEach((id) => { if (!$('#' + id)) { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); } });
    const cd = $('#cd'), cr = $('#cr'), cg = $('#cg');
    let x = 0, y = 0, rx = 0, ry = 0, gx = 0, gy = 0;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
    (function frame() {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      gx += (x - gx) * 0.08; gy += (y - gy) * 0.08;
      cd.style.transform = `translate(${x - 3.5}px,${y - 3.5}px)`;
      cr.style.transform = `translate(${rx - 15}px,${ry - 15}px)`;
      cg.style.transform = `translate(${gx - 120}px,${gy - 120}px)`;
      requestAnimationFrame(frame);
    })();
    document.addEventListener('pointerover', (e) => cr.classList.toggle('big', !!e.target.closest('a,button,input,select')));
  }

  function initCardGlow() {
    document.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.card');
      if (!c) return;
      const b = c.getBoundingClientRect();
      c.style.setProperty('--mx', e.clientX - b.left + 'px');
      c.style.setProperty('--my', e.clientY - b.top + 'px');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectChrome();
    buildFieldsFromData();
    initCursor();
    initCardGlow();
    const main = $('main');
    if (main) main.classList.add('enter');
  });

  window.Finova = {
    CUR, fmt, esc, toast, store,
    getCurrency: () => cc,
    setCurrency,
    validateNumber, validateSelect, validateText,
    recordLocal, saveRecord,
  };
})();
