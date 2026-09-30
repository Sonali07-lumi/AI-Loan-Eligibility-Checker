/**
 * Credit Score Analyzer.
 * Flow: validate -> POST /api/credit/analyze -> render. Falls back to a
 * local rule-based interpretation if the backend cannot be reached.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const F = () => window.Finova;
  const LEVEL_ICON = { good: '✓', mid: '!', low: '✕' };

  const BANDS = [
    [800, 'Excellent', 'good', 'Lenders typically offer their best terms.'],
    [750, 'Very good', 'good', 'Most lenders view this as low risk.'],
    [700, 'Good', 'good', 'Generally acceptable, with competitive offers likely.'],
    [650, 'Fair', 'mid', 'Approval is possible, but rates may be higher.'],
    [550, 'Poor', 'low', 'Approval is harder and costs are usually higher.'],
    [300, 'Very poor', 'low', 'Most mainstream lenders may decline; rebuilding credit is the priority.'],
  ];

  function localAssessment({ score, utilization, onTime, history, apps }) {
    const band = BANDS.find((b) => score >= b[0]);
    const positive = [], attention = [];
    if (utilization !== '') (utilization <= 30 ? positive : attention).push(
      utilization <= 30 ? `Utilization of ${utilization}% is within the commonly recommended 30%.`
        : `Utilization of ${utilization}% is high; aim to stay under 30% of your limits.`);
    if (onTime !== '') {
      if (onTime >= 98) positive.push('Almost all payments were on time — the biggest driver of credit scores.');
      else if (onTime < 95) attention.push(`Only ${onTime}% of payments were on time; missed payments weigh heavily.`);
    }
    if (history !== '') {
      if (history >= 7) positive.push(`A ${history}-year history shows long-term credit management.`);
      else if (history < 3) attention.push(`A ${history}-year history is short; keep older accounts open.`);
    }
    if (apps !== '') {
      if (apps <= 2) positive.push('Few recent applications keeps credit-seeking risk signals low.');
      else if (apps >= 5) attention.push(`${apps} recent applications may signal credit-seeking; space future ones out.`);
    }
    return {
      user_provided_score: score, band: band[1], band_level: band[2], band_detail: band[3],
      positive_factors: positive.length ? positive : ['Nothing flagged as positive from the details provided.'],
      attention_factors: attention.length ? attention : ['Nothing flagged from the details provided.'],
      ai_explanation: null,
    };
  }

  function render(r) {
    const list = (arr) => `<ul class="pl muted">${arr.map((x) => `<li>${F().esc(x)}</li>`).join('')}</ul>`;
    const aiBlock = r.ai_explanation
      ? `<h3 class="mt">AI-generated explanation</h3><p class="muted"><span class="ai">Claude</span> — ${F().esc(r.ai_explanation)}</p>`
      : '';
    $('#cr-res').innerHTML = `
      <p class="sl">User-provided credit score</p>
      <div class="stat big">${r.user_provided_score}</div>
      <div class="meter" role="img" aria-label="Score position on a 300 to 900 scale"><i style="left:${(r.user_provided_score - 300) / 6}%"></i></div>
      <p class="sl"><span class="ai">Rule-based interpretation</span></p>
      <span class="badge ${r.band_level}">${LEVEL_ICON[r.band_level]} ${r.band}</span>
      <p class="muted" style="margin-top:12px">${r.band_detail}</p>
      <h3>Positive factors</h3>${list(r.positive_factors)}
      <h3>Needs attention</h3>${list(r.attention_factors)}
      ${aiBlock}
      <p class="note">Score ranges differ by bureau. This is not an official credit-bureau score.</p>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#cr-f');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const Fx = F();
      const score = Fx.validateNumber('c-s', { name: 'your credit score', min: 300, max: 900, integer: true });
      const utilization = Fx.validateNumber('c-u', { name: 'utilization', max: 100, required: false });
      const onTime = Fx.validateNumber('c-p', { name: 'on-time payments', max: 100, required: false });
      const history = Fx.validateNumber('c-h', { name: 'history', max: 60, required: false });
      const apps = Fx.validateNumber('c-i', { name: 'applications', max: 50, integer: true, required: false });
      if ([score, utilization, onTime, history, apps].includes(null)) return;

      const currency = Fx.getCurrency();
      const submitBtn = form.querySelector('button[type=submit]');
      const original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Analyzing your credit profile...';
      $('#cr-res').innerHTML = '<p class="empty"><span class="pulse"><i></i><i></i><i></i></span> Analyzing your credit profile...</p>';

      const payload = {
        credit_score: score,
        utilization_pct: utilization === '' ? null : utilization,
        on_time_payment_pct: onTime === '' ? null : onTime,
        credit_history_years: history === '' ? null : history,
        recent_applications: apps === '' ? null : apps,
        currency,
      };

      let result;
      if (window.FinovaAPI) {
        const res = await window.FinovaAPI.analyzeCredit(payload);
        if (res.ok) result = res.data;
        else Fx.toast('Backend unavailable — showing an offline interpretation instead.');
      }
      if (!result) result = localAssessment({ score, utilization, onTime, history, apps });

      render(result);
      Fx.saveRecord('credit', result.band, { score }, result.ai_explanation);
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    });
  });
})();
