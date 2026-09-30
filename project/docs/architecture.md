# Architecture

## Overview

FINOVA is an AI-powered financial decision-support platform with four tools: Loan
Eligibility Checker, Credit Score Analyzer, EMI Calculator, and AI Financial Tips.
It simplifies financial information for general, educational use — it does not
make real lending decisions, generate official credit-bureau scores, or give
professional financial advice.

## Problem statement

People often need quick, private, judgment-free answers to financial questions
("would I likely qualify for this loan?", "what does my credit score mean?",
"what would my EMI be?") before approaching a bank or advisor. FINOVA answers
those questions with transparent rules and optional AI-written explanations,
clearly labelled as estimates.

## Objectives

- Give instant, transparent estimates using clearly documented rules.
- Use Claude only to *explain* numbers already computed by rules — never to
  invent numbers or make an approval decision.
- Never expose secrets (Claude API key, Google credentials) to the browser.
- Work fully responsively across mobile, tablet, laptop, and desktop.
- Support multiple currencies throughout, with no currency hardcoded.

## Technology stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript, responsive CSS, no build step.
- **Backend:** Python, FastAPI, Pydantic models, REST endpoints.
- **AI:** Anthropic Claude API, called only from the backend.
- **Storage:** Google Sheets (via a service account), behind a swappable
  `sheets_service.py` module so it can be replaced by a real database later.
- **Deployment:** frontend on Vercel/Netlify; backend on any Python host.

## System architecture

```
 USER
   |
 HTML/CSS/JS  (frontend/)
   |
 Client-side validation  (js/main.js validators)
   |
 FastAPI REST API  (backend/main.py, backend/routes/*)
   |
 Business logic  (backend/services/eligibility_service.py)
   |
   +---------------------+---------------------+
   |                                           |
 Claude API                              Google Sheets
 (claude_service.py)                     (sheets_service.py)
   |                                           |
   +---------------------+---------------------+
                          |
                 FastAPI response (Pydantic schema)
                          |
                       Frontend
                          |
                      User sees result
```

The EMI Calculator is the one tool that never leaves the browser: it only
needs the standard reducing-balance formula, so `js/emi.js` computes it
directly with no network call.

## Frontend flow

1. Each page (`loan.html`, `credit.html`, `emi.html`, `tips.html`) has a form
   built from `data-f="id|label|placeholder|type"` attributes, expanded into
   real inputs by `main.js` at load time.
2. On submit, `js/main.js`'s `validateNumber` / `validateSelect` / `validateText`
   run first — required fields, numeric ranges, and selection checks.
3. Only after validation passes does the page call `window.FinovaAPI` (from
   `js/api.js`), which posts JSON to the backend with a 12s timeout.
4. If the backend call fails or times out, each page (`loan.js`, `credit.js`,
   `tips.js`) falls back to the same logic run locally in JavaScript, and
   labels the result so the person knows AI/backend features were skipped.
5. Results render into a `.card` with `aria-live="polite"` so screen readers
   announce them.

## Backend flow

`backend/main.py` wires together:

- CORS (`ALLOWED_ORIGINS` env var)
- A global exception handler that never returns a raw stack trace
- Four routers: `loan`, `credit`, `tips`, `records`
- `/health`, which reports whether Claude and Sheets are configured — useful
  for confirming a deployment without exposing secrets

Each route: validates via Pydantic → calls `eligibility_service` for the
deterministic numbers → optionally calls `claude_service` for a plain-language
explanation → returns a typed response. Errors are caught and turned into a
friendly `HTTPException` detail message.

## API flow

See `docs/workflow.md` for the full endpoint list and example payloads.

## Claude integration

`backend/services/claude_service.py` builds every prompt itself (the frontend
never sends a raw prompt) with a fixed system prompt that:

- Forbids claiming to be a bank/lender/bureau or guaranteeing approval
- Forbids inventing numbers or converting currencies
- Requires the currency code given to be used verbatim
- Keeps responses short and neutral

If `ANTHROPIC_API_KEY` is unset, or the call errors/times out, the function
returns `None` and the route falls back to rule-based text — the person
always gets a usable response.

## Google Sheets integration

`backend/services/sheets_service.py` exposes exactly two operations,
`append_record()` and `get_records()`. Everything else in the codebase talks
to these two functions, so replacing Sheets with a real database later means
rewriting one file. Credentials are loaded server-side from a service-account
JSON file path (`GOOGLE_SERVICE_ACCOUNT_FILE`), never from the frontend.

## Security

- Secrets only ever live in backend environment variables / `.env` (git-ignored).
- Frontend and backend both validate input; the backend is the source of truth.
- CORS restricts which origins may call the API.
- The global exception handler in `main.py` prevents stack-trace leaks.
- Minimal data collection: only the fields each tool needs.

## Testing

See `docs/workflow.md` for the test matrix (valid/invalid/boundary inputs per
tool, Claude/Sheets failure simulation, and responsive checks).

## Deployment

See the root `README.md` for step-by-step frontend and backend deployment
instructions.

## Future enhancements

User authentication, a real ML loan-prediction model, PDF report generation,
advanced analytics, real financial-institution integrations, a dedicated
production database, a user profile system, and historical financial
dashboards. None of these are implemented in this version.
