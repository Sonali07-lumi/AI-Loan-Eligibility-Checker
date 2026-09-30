# Workflow & API reference

## Request lifecycle (loan example)

1. Person fills in the loan form on `loan.html`.
2. `js/main.js` validators check each field on submit; if any fail, inline
   `<p class="err">` messages appear next to the field and nothing is sent.
3. `js/loan.js` builds a JSON payload and calls `FinovaAPI.checkLoan(payload)`.
4. The submit button shows a spinner and "Analyzing your financial
   profile..."; it is disabled to prevent duplicate submissions.
5. `POST /api/loan/check` validates the payload again with Pydantic, computes
   the estimate in `eligibility_service.assess_loan()`, and — if
   `use_ai_explanation` is true and `ANTHROPIC_API_KEY` is set — asks Claude
   for a short plain-language explanation.
6. The typed `LoanResponse` comes back and is rendered into the result card.
7. The result is also saved to `localStorage` (always) and, best-effort, to
   the backend's `/api/records/save` (which only persists if Google Sheets is
   configured).
8. If step 3-6 fails or times out, `loan.js` runs the same rules locally in
   JavaScript and shows a toast: "Backend unavailable — showing an offline
   estimate instead."

## Endpoints

### `GET /health`
Returns `{ status, claude_configured, sheets_configured }`. No inputs.

### `POST /api/loan/check`
```json
{
  "age": 29,
  "monthly_income": 60000,
  "employment_type": "salaried",
  "credit_score": 720,
  "loan_amount": 800000,
  "tenure_years": 5,
  "existing_monthly_debt": 5000,
  "currency": "INR",
  "use_ai_explanation": true
}
```
Returns a `LoanResponse`: status, fit_score, estimated_emi,
indicative_max_loan, assumed_annual_rate, currency, factors[], suggestions[],
ai_explanation (nullable), disclaimer.

### `POST /api/credit/analyze`
```json
{
  "credit_score": 690,
  "utilization_pct": 45,
  "on_time_payment_pct": 96,
  "credit_history_years": 4,
  "recent_applications": 3,
  "currency": "USD"
}
```
Returns a `CreditResponse`: user_provided_score, band, band_level,
band_detail, positive_factors[], attention_factors[], ai_explanation
(nullable), disclaimer.

### `POST /api/financial-tips`
```json
{
  "financial_goal": "Save for a car",
  "monthly_income": 4000,
  "monthly_expenses": 3100,
  "current_savings": 2000,
  "goal_target_amount": 12000,
  "currency": "USD"
}
```
Returns a `TipsResponse`: currency, needs_budget, wants_budget,
savings_budget, ai_insights, source (`"claude"` or `"fallback"`), disclaimer.

### `POST /api/records/save`
```json
{
  "tool": "loan",
  "currency": "INR",
  "inputs": { "amount": 800000, "emi": 17245.32 },
  "result_summary": "Likely eligible",
  "ai_summary": null
}
```
Returns `{ "saved": true|false, "reason"?: "..." }`. Never fails the whole
request if Sheets is unreachable — it reports `saved: false` instead.

### `GET /api/records?limit=20`
Returns `{ "records": [...], "configured": true|false }`.

## Test matrix

**Frontend:** navigation between all pages; layout at ~375px, ~768px,
~1024px, and ~1440px widths; form validation messages; reduced-motion mode;
keyboard-only navigation and focus visibility.

**Loan checker:** valid mid-range input; credit score at 300/900 boundaries;
age at 18/70 boundaries; tenure at 1/30 boundaries; zero/negative income
(rejected); `employment_type = unemployed` (score capped low).

**Credit analyzer:** valid score with all optional fields; valid score with
no optional fields; score below 300 / above 900 (rejected); utilization at
0/100 boundaries.

**EMI calculator:** standard case; 0% interest rate (falls back to
principal/months); very short (1 month) and long (480 months) tenures;
empty/invalid inputs (shows the empty-state message, not an error).

**AI Financial Tips / Claude:** `ANTHROPIC_API_KEY` set and reachable
(`source: "claude"`); key unset (`source: "fallback"`); simulate a timeout by
setting a very low `REQUEST_TIMEOUT_SECONDS` temporarily; simulate an empty
Claude response (function should fall back, not crash).

**Google Sheets:** valid service account + sheet ID (`saved: true`); missing
env vars (`saved: false, reason: "..."`, no exception); invalid/unreachable
sheet ID (`GET /api/records` returns `configured: true, records: []` rather
than a 500).

## Diagram

See the ASCII diagram in `docs/architecture.md` under "System architecture".
