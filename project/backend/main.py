"""
FINOVA backend — FastAPI entrypoint.

Run locally:
    uvicorn main:app --reload --port 8000

Environment variables (see .env.example):
    ANTHROPIC_API_KEY          Claude API key. If unset, AI explanations fall
                                back to rule-based text instead of failing.
    GOOGLE_SERVICE_ACCOUNT_FILE Path to a Google service-account JSON key.
    GOOGLE_SHEET_ID             The spreadsheet ID to store records in.
    GOOGLE_SHEET_TAB            Worksheet/tab name (default: "records").
    ALLOWED_ORIGINS             Comma-separated list of allowed CORS origins.
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.schemas import HealthResponse
from routes import credit, loan, records, tips
from services import claude_service, sheets_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("finova.main")

app = FastAPI(
    title="FINOVA API",
    description="Backend for the FINOVA AI-powered financial decision support platform.",
    version="1.0.0",
)

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak stack traces to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


app.include_router(loan.router)
app.include_router(credit.router)
app.include_router(tips.router)
app.include_router(records.router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        claude_configured=claude_service.is_configured(),
        sheets_configured=sheets_service.is_configured(),
    )
