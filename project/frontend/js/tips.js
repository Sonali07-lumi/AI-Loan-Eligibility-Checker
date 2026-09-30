/**
 * AI Financial Tips.
 * Flow: validate -> POST /api/financial-tips -> backend calls Claude ->
 * render. Falls back to a fixed, rule-based message if Claude or the
 * backend is unavailable, and always labels which one produced the text.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const F = () => window.Finova;

  function localFallback({ goal, income, expenses, savings, target }, currency) {
    const fmt = (v) => F().fmt(v, currency);
    const surplus = income - expenses;
    const lines = [];
    lines.push(surplus > 0
      ? `You have about ${fmt(surplus)} left each month — automate a transfer toward "${goal}" on payday.`
      : `Expenses are at or above income (${fmt(surplus)} left each month). Trim non-essentials before setting new goals.`);
    const ef = savings / Math.max(expenses, 1);
    lines.push(ef >= 6
      ? `Your savings cover about ${ef.toFixed(1)} months of expenses, a healthy emergency buffer.`
      : `Your savings cover about ${ef.toFixed(1)} months of expenses. Build toward 3-6 months (${fmt(expenses * 3)}-${fmt(expenses * 6)}) first.`);
    if (target) {
      const need = Math.max(0, target - savings);
      lines.push(!need ? 'Your current savings already cover this goal.'
        : surplus > 0 ? `You still need ${fmt(need)}. Saving ${fmt(surplus)} monthly gets you there in about ${Math.ceil(need / surplus)} months.`
          : `You still need ${fmt(need)}. Free up monthly surplus first to set a timeline.`);
    }
    lines.push('Review recurring subscriptions and high-interest debt; paying those down is a guaranteed return.');
    return lines.join(' ');
  }

  function render(res, goal) {
    $('#tp-res').innerHTML = `
      <h3>Plan for: ${F().esc(goal)}</h3>
      <div class="g g3">
        <div><div class="stat">${F().fmt(res.needs_budget, res.currency)}</div><div class="sl">Needs (50%)</div></div>
        <div><div class="stat">${F().fmt(res.wants_budget, res.currency)}</div><div class="sl">Wants (30%)</div></div>
        <div><div class="stat">${F().fmt(res.savings_budget, res.currency)}</div><div class="sl">Savings (20%)</div></div>
      </div>
      <h3 class="mt">Suggestions</h3>
      <p class="muted" style="white-space:pre-line">${F().esc(res.ai_insights)}</p>
      <p class="note">
        <span class="ai">${res.source === 'claude' ? 'Claude-generated insights.' : 'Rule-based insights (AI unavailable).'}</span>
        General information only, not professional financial advice.
      </p>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#tp-f');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const Fx = F();
      const goal = Fx.validateText('t-goal', { name: 'your financial goal' });
      const income = Fx.validateNumber('t-inc', { name: 'your monthly income', greaterThanZero: true });
      const expenses = Fx.validateNumber('t-exp', { name: 'your monthly expenses' });
      const savings = Fx.validateNumber('t-sav', { name: 'your savings' });
      const target = Fx.validateNumber('t-tar', { name: 'the goal cost', greaterThanZero: true, required: false });
      if ([goal, income, expenses, savings, target].includes(null)) return;

      const currency = Fx.getCurrency();
      const submitBtn = form.querySelector('button[type=submit]');
      const original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> AI is analyzing your information...';
      $('#tp-res').innerHTML = '<p class="empty"><span class="pulse"><i></i><i></i><i></i></span> AI is analyzing your information...</p>';

      const payload = {
        financial_goal: goal, monthly_income: income, monthly_expenses: expenses,
        current_savings: savings, goal_target_amount: target === '' ? null : target, currency,
      };

      let result;
      if (window.FinovaAPI) {
        const res = await window.FinovaAPI.getTips(payload);
        if (res.ok) result = res.data;
        else Fx.toast('AI service unavailable — showing general suggestions instead.');
      }
      if (!result) {
        const needs = income * 0.5, wants = income * 0.3, save = income * 0.2;
        result = {
          currency, needs_budget: needs, wants_budget: wants, savings_budget: save,
          ai_insights: localFallback({ goal, income, expenses, savings, target: target === '' ? 0 : target }, currency),
          source: 'fallback',
        };
      }

      render(result, goal);
      Fx.saveRecord('tips', goal.slice(0, 40), { surplus: income - expenses }, result.source === 'claude' ? result.ai_insights : null);
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    });
  });
})();
