# FINOVA — AI-powered financial decision support

Four tools in one platform: Loan Eligibility Checker, Credit Score Analyzer, EMI Calculator, and AI Financial Tips.

> Educational estimates and AI-generated insights only. Not official loan approvals, credit-bureau scores, or professional financial advice.

## Project structure

```
project/
├── frontend/        Static HTML/CSS/JS (deploy to Vercel/Netlify)
│   ├── *.html        One page per section
│   ├── css/          style.css, responsive.css, animations.css
│   └── js/           api.js, main.js, loan.js, credit.js, emi.js, tips.js
├── backend/          FastAPI app (deploy to Render/Railway/Fly.io/etc.)
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/        loan.py, credit.py, tips.py, records.py
│   ├── services/      claude_service.py, sheets_service.py, eligibility_service.py
│   └── models/        schemas.py
└── docs/              architecture.md, workflow.md
```

## Quick start (local development)

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # then fill in real values
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/health` — it should return `{"status": "ok", ...}`.

Without any keys set, the API still runs: `claude_configured` and `sheets_configured` will
be `false`, AI explanations fall back to rule-based text, and record-saving reports
`saved: false` instead of failing.

### 2. Frontend

The frontend is plain static files — no build step. Serve it with any static file server, e.g.:

```bash
cd frontend
python3 -m http.server 5500
```

Visit `http://localhost:5500`. By default the frontend talks to `http://localhost:8000`
(see `js/api.js`). To point it at a different backend, add this **before** the
`api.js` script tag on each page:

```html
<script>window.FINOVA_API_BASE = "https://your-backend.example.com";</script>
```

## Environment variables (backend/.env)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | No (recommended) | Enables real Claude explanations/tips. Without it, rule-based fallback text is used. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | No | Path to a Google service-account JSON key, for Sheets storage. |
| `GOOGLE_SHEET_ID` | No | Spreadsheet ID to store records in. |
| `GOOGLE_SHEET_TAB` | No | Worksheet/tab name (default `records`). |
| `ALLOWED_ORIGINS` | Yes for production | Comma-separated list of frontend origins allowed by CORS. |

Never commit a real `.env` file or a service-account JSON key — both are already excluded
in `.gitignore`.

## Deployment

**Frontend → Vercel or Netlify**
- Point the deploy at the `frontend/` folder as a static site (no build command needed).
- Set `window.FINOVA_API_BASE` to your live backend URL (see above), or wire it through
  your host's environment/templating if you prefer.

**Backend → any Python host (Render, Railway, Fly.io, etc.)**
- Root directory: `backend/`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set the environment variables above in the host's dashboard/secrets manager.
- Set `ALLOWED_ORIGINS` to your deployed frontend's URL(s).

## Testing notes

See `docs/architecture.md` and `docs/workflow.md` for the request flow and what to test
(valid/invalid/boundary inputs for each tool, Claude and Sheets failure modes, and
responsive layout checks across mobile/tablet/laptop/desktop widths).

## Future enhancements (not implemented)

User authentication, a real ML loan-prediction model, PDF report generation, advanced
analytics, real financial-institution integrations, a dedicated production database, a
user profile system, and historical financial dashboards.
