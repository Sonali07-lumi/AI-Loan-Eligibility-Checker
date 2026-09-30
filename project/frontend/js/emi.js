/**
 * EMI Calculator — pure front-end, no backend call needed (see project spec
 * section 11): it only requires the standard reducing-balance formula.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const F = () => window.Finova;

  function emi(principal, annualRate, months) {
    const i = annualRate / 1200;
    if (!i) return principal / months;
    const f = Math.pow(1 + i, months);
    return (principal * i * f) / (f - 1);
  }

  const FIELDS = ['e-amt', 'e-rate', 'e-ten'];

  function calc() {
    const box = $('#emi-res');
    if (!box) return;
    const yearMode = $('#e-unit').value === 'y';
    const opts = {
      'e-amt': { name: 'the loan amount', greaterThanZero: true },
      'e-rate': { name: 'the interest rate', max: 50 },
      'e-ten': { name: 'the tenure', greaterThanZero: true, integer: true, max: yearMode ? 40 : 480 },
    };
    const values = FIELDS.map((id) => {
      const el = $('#' + id);
      if (!el.value.trim()) {
        const err = $('#' + id + '-e');
        if (err) err.textContent = '';
        el.removeAttribute('aria-invalid');
        return '';
      }
      return F().validateNumber(id, opts[id]);
    });
    if (values.includes('') || values.includes(null)) {
      box.innerHTML = '<p class="empty">Enter amount, rate and tenure to see your EMI.</p>';
      return;
    }
    const [P, r, t] = values;
    const n = yearMode ? t * 12 : t;
    const monthly = emi(P, r, n);
    const total = monthly * n;
    const interest = total - P;
    const interestPct = (interest / total) * 100;
    const fmt = F().fmt;

    box.innerHTML = `
      <p class="sl">Monthly EMI</p>
      <div class="stat big">${fmt(monthly)}</div>
      <div class="row" style="align-items:center;margin:18px 0">
        <div class="donut" role="img" aria-label="Interest is ${interestPct.toFixed(0)} percent of total repayment"
          style="background:conic-gradient(var(--a) 0 ${100 - interestPct}%,var(--ai) ${100 - interestPct}% 100%)"></div>
        <div>
          <div class="lg"><i style="background:var(--a)"></i>Principal ${(100 - interestPct).toFixed(0)}%</div>
          <div class="lg"><i style="background:var(--ai)"></i>Interest ${interestPct.toFixed(0)}%</div>
        </div>
      </div>
      <div class="g g3">
        <div><div class="stat">${fmt(P)}</div><div class="sl">Total principal</div></div>
        <div><div class="stat">${fmt(interest)}</div><div class="sl">Total interest</div></div>
        <div><div class="stat">${fmt(total)}</div><div class="sl">Total repayment</div></div>
      </div>
      <button class="btn ghost mt" id="emi-save" type="button" data-emi="${monthly}" data-p="${P}" data-n="${n}">Save to activity</button>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    FIELDS.forEach((id) => $('#' + id) && $('#' + id).addEventListener('input', calc));
    $('#e-unit') && ($('#e-unit').onchange = calc);
    $('#emi-reset') && ($('#emi-reset').onclick = () => {
      FIELDS.forEach((id) => { $('#' + id).value = ''; });
      $('#e-unit').value = 'y';
      calc();
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('#emi-save');
      if (!b) return;
      F().saveRecord('emi', 'EMI calculated', { emi: +b.dataset.emi, principal: +b.dataset.p, months: +b.dataset.n });
      F().toast('Saved to your recent activity.');
    });
    document.addEventListener('finova:currency-changed', calc);
    calc();
  });
})();
