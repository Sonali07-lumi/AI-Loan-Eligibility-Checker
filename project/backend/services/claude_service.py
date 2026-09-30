"""
Backend-only wrapper around the Anthropic Claude API.

The API key lives in the ANTHROPIC_API_KEY environment variable and is never
sent to, or read from, the browser. If the key is missing or the call fails,
every function returns None so callers can fall back to rule-based text
instead of breaking the response.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("finova.claude")

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
MODEL = "claude-sonnet-4-6"
REQUEST_TIMEOUT_SECONDS = 15
MAX_TOKENS = 400

SYSTEM_PROMPT = (
    "You are a financial-literacy assistant embedded in an app called FINOVA. "
    "You write short, plain-language, educational explanations of numbers the "
    "backend has already computed. Rules you must always follow: "
    "1) Never claim to be a bank, lender, or credit bureau, and never state "
    "that a loan is guaranteed to be approved or a score is official. "
    "2) Never give specific legal, tax, or investment-product advice, and "
    "never suggest illegal or high-risk shortcuts (e.g. fraud, payday-loan "
    "chains, gambling). 3) Use the currency code and amounts given to you "
    "verbatim; never invent numbers or convert currencies. 4) Keep the reply "
    "under 130 words, in 2-4 short paragraphs or a short list, in a "
    "supportive and neutral tone."
)


def _api_key() -> Optional[str]:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    return key or None


def is_configured() -> bool:
    return _api_key() is not None


def _call_claude(user_prompt: str) -> Optional[str]:
    key = _api_key()
    if not key:
        logger.info("ANTHROPIC_API_KEY not set; skipping Claude call.")
        return None

    headers = {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    payload = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_prompt}],
    }

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = client.post(ANTHROPIC_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        text = "\n".join(p for p in parts if p).strip()
        return text or None
    except httpx.TimeoutException:
        logger.warning("Claude API call timed out.")
        return None
    except httpx.HTTPStatusError as exc:
        logger.warning("Claude API returned %s: %s", exc.response.status_code, exc.response.text[:300])
        return None
    except Exception:  # noqa: BLE001 - never let AI errors break the response
        logger.exception("Unexpected error calling Claude API.")
        return None


def explain_loan_result(payload: dict) -> Optional[str]:
    prompt = (
        "A user's loan eligibility was estimated by rules, not by you. Here is the data as JSON: "
        f"{payload}. Write a short explanation of what the estimate means and 2-3 general next "
        "steps, using the given currency code for any amounts you mention."
    )
    return _call_claude(prompt)


def explain_credit_result(payload: dict) -> Optional[str]:
    prompt = (
        "A user's credit-score interpretation was computed by rules, not by you. Here is the data "
        f"as JSON: {payload}. Explain in plain language what this band generally means for "
        "borrowing, and 2-3 general habits that tend to help."
    )
    return _call_claude(prompt)


def generate_financial_tips(payload: dict) -> Optional[str]:
    prompt = (
        "A user wants financial tips. Here is their situation as JSON (amounts are in the given "
        f"currency code — use that code, never another one): {payload}. Write practical, encouraging "
        "suggestions for budgeting and reaching their stated goal."
    )
    return _call_claude(prompt)
