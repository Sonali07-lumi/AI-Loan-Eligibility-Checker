/**
 * Loan Eligibility Checker.
 * Flow: validate in the browser -> POST /api/loan/check -> render result.
 * If the backend is unreachable, falls back to the same rules run locally
 * so the tool still works, clearly labelled as an offline estimate.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const F = () => window.Finova;
  const ASSUMED_RATE = 10.5;

  const LEVEL_ICON = { good: '✓ Strong', mid: '! Moderate', low: '✕ Weak' };
  const STATUS_BADGE = {
    likely_eligible: ['good', '✓ Likely eligible'],
    possibly_eligible: ['mid', '! Possibly eligible'],
    unlikely_eligible: ['low', '✕ Unlikely eligible'],
  };

  function emi(P, rate, n) {
    const i = rate / 1200;
    if (!i) return P / n;
    const f = Math.pow(1 + i, n);
    return (P * i * f) / (f - 1);
  }
  function presentValue(paymentAvailable, rate, n) {
    const i = rate / 1200;
    if (!i) return paymentAvailable * n;
    const f = Math.pow(1 + i, n);
    return (paymentAvailable * (f - 1)) / (i * f);
  }

  function localAssessment(input) {
    const { age, monthlyIncome, employmentType, creditScore, loanAmount, tenureYears, existingDebt } = input;
    const n = tenureYears * 12;
    const estEmi = emi(loanAmount, ASSUMED_RATE, n);
    const ratio = (existingDebt + estEmi) / monthlyIncome;
    const mult = loanAmount / (monthlyIncome * 12);
    const factors = [];
    let score = 0;
    const add = (label, pts, max, detail) => {
      score += pts;
      factors.push({ label, level: pts / max >= 0.75 ? 'good' : pts / max >= 0.4 ? 'mid' : 'low', detail });
    };
    add('Credit score', creditScore >= 750 ? 40 : creditScore >= 700 ? 32 : creditScore >= 650 ? 22 : creditScore >= 600 ? 12 : 4, 40,
      creditScore >= 700 ? 'Your score is in a range lenders usually view favourably.' : creditScore >= 650 ? 'A fair score may lead to higher rates or extra checks.' : 'A lower score can limit approval or raise the rate.');
    const rp = ratio <= 0.35 ? 40 : ratio <= 0.45 ? 30 : ratio <= 0.55 ? 18 : ratio <= 0.65 ? 8 : 0;
    add('Debt and income', rp, 40, `With this loan, about ${Math.round(ratio * 100)}% of your income would go to loan payments. Lenders often prefer 40-50% or less.`);
    const EMP = { salaried: [10, 'Stable salaried income is generally viewed favourably.'], retired: [8, 'Pension income is steady, though lenders may look at age and tenure.'], self: [7, 'Self-employed applicants usually need income proof over several years.'], business: [7, 'Business income is assessed on documented profits and history.'], unemployed: [0, 'Without regular income, unsecured credit is unlikely to be approved.'] }[employmentType];
    add('Employment', EMP[0], 10, EMP[1]);
    let agePts = (age < 21 || age > 60) ? 3 : 10;
    const maturity = age + tenureYears;
    if (maturity > 70) agePts = Math.max(0, agePts - 5);
    add('Age and tenure', agePts, 10, maturity > 70 ? `The loan would end at age ${maturity}, which many lenders limit.` : 'Your age and tenure fit typical lending windows.');
    factors.push({ label: 'Loan size', level: mult <= 3 ? 'good' : mult <= 5 ? 'mid' : 'low', detail: `The loan is about ${mult.toFixed(1)}x your annual income.` });
    if (employmentType === 'unemployed') score = Math.min(score, 45);
    const status = score >= 75 ? 'likely_eligible' : score >= 50 ? 'possibly_eligible' : 'unlikely_eligible';
    const suggestions = [];
    if (creditScore < 700) suggestions.push('Raise your score with on-time payments and lower card utilization.');
    if (ratio > 0.45) suggestions.push('Reduce existing payments, or choose a smaller amount or a longer tenure.');
    if (maturity > 70) suggestions.push('Pick a shorter tenure so the loan ends earlier in life.');
    if (!suggestions.length) suggestions.push('Compare rates across several lenders before applying.');
    const availableEmi = Math.max(0, monthlyIncome * 0.4 - existingDebt);
    return {
      status, fit_score: Math.round(score), estimated_emi: estEmi,
      indicative_max_loan: availableEmi > 0 ? presentValue(availableEmi, ASSUMED_RATE, n) : 0,
      assumed_annual_rate: ASSUMED_RATE, factors, suggestions, ai_explanation: null,
    };
  }

  function render(result, currency) {
    const fmt = (v) => F().fmt(v, currency);
    const [level, label] = STATUS_BADGE[result.status];
    const factorsHtml = `<ul class="fac">${result.factors.map((f) =>
      `<li><span class="lv ${f.level}">${LEVEL_ICON[f.level]}</span><span class="tx"><b>${f.label}.</b> ${f.detail}</span></li>`).join('')}</ul>`;
    const aiBlock = result.ai_explanation
      ? `<h3 class="mt">AI-generated explanation</h3><p class="muted"><span class="ai">Claude</span> — ${F().esc(result.ai_explanation)}</p>`
      : '';
    $('#loan-res').innerHTML = `
      <span class="badge ${level}">${label}</span>
      <p class="muted" style="margin-top:12px">Estimated fit score: <b style="color:var(--t)">${result.fit_score}/100</b> · Estimate only</p>
      <div class="g g2">
        <div><div class="stat">${fmt(result.estimated_emi)}</div><div class="sl">Estimated EMI at an assumed ${result.assumed_annual_rate}% rate</div></div>
        <div><div class="stat">${fmt(result.indicative_max_loan)}</div><div class="sl">Indicative loan at a 40% obligation ratio</div></div>
      </div>
      <h3 class="mt">Key factors</h3>${factorsHtml}
      <h3>General suggestions</h3><ul class="pl muted">${result.suggestions.map((s) => `<li>${s}</li>`).join('')}</ul>
      ${aiBlock}
      <p class="note">Educational estimate only — not an official loan approval, credit-bureau score, or professional financial advice.</p>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#loan-f');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const Fx = F();
      const age = Fx.validateNumber('l-age', { name: 'your age', min: 18, max: 70, integer: true });
      const income = Fx.validateNumber('l-inc', { name: 'your monthly income', greaterThanZero: true });
      const employmentType = Fx.validateSelect('l-emp', 'your employment type');
      const creditScore = Fx.validateNumber('l-cs', { name: 'your credit score', min: 300, max: 900, integer: true });
      const loanAmount = Fx.validateNumber('l-amt', { name: 'the loan amount', greaterThanZero: true });
      const tenureYears = Fx.validateNumber('l-yrs', { name: 'the tenure', min: 1, max: 30, integer: true });
      const existingDebt = Fx.validateNumber('l-debt', { name: 'existing payments', required: false });
      if ([age, income, employmentType, creditScore, loanAmount, tenureYears, existingDebt].includes(null)) return;

      const debt = existingDebt || 0;
      const currency = Fx.getCurrency();
      const submitBtn = form.querySelector('button[type=submit]');
      const original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Analyzing your financial profile...';
      $('#loan-res').innerHTML = '<p class="empty"><span class="pulse"><i></i><i></i><i></i></span> Analyzing your financial profile...</p>';

      const payload = {
        age, monthly_income: income, employment_type: employmentType, credit_score: creditScore,
        loan_amount: loanAmount, tenure_years: tenureYears, existing_monthly_debt: debt, currency,
      };

      let result;
      if (window.FinovaAPI) {
        const res = await window.FinovaAPI.checkLoan(payload);
        if (res.ok) {
          result = res.data;
        } else {
          Fx.toast('Backend unavailable — showing an offline estimate instead.');
        }
      }
      if (!result) {
        result = localAssessment({ age, monthlyIncome: income, employmentType, creditScore, loanAmount, tenureYears, existingDebt: debt });
        result.currency = currency;
      }

      render(result, currency);
      Fx.saveRecord('loan', STATUS_BADGE[result.status][1].replace(/^[✓!✕]\s*/, ''), { amount: loanAmount, emi: result.estimated_emi }, result.ai_explanation);
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    });
  });
})();
