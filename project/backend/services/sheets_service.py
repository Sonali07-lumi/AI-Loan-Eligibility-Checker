"""
Backend-only Google Sheets integration used as the project's data store.

Design goal: every other module talks to this file through append_record()
and get_records() only, so swapping Google Sheets for a real database later
means rewriting this one file, not the routes.

Auth: a service-account JSON key, referenced by path via the
GOOGLE_SERVICE_ACCOUNT_FILE environment variable. The credentials never
leave the server and are never sent to the frontend.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

logger = logging.getLogger("finova.sheets")

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADER = ["timestamp", "tool", "currency", "inputs", "result_summary", "ai_summary"]

_client = None  # cached gspread client
_sheet = None  # cached worksheet


def is_configured() -> bool:
    return bool(os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")) and bool(os.getenv("GOOGLE_SHEET_ID"))


def _get_sheet():
    """Lazily build and cache the gspread worksheet handle."""
    global _client, _sheet
    if _sheet is not None:
        return _sheet
    if not is_configured():
        return None

    try:
        import gspread  # imported here so the package is only required when Sheets is actually used
        from google.oauth2.service_account import Credentials

        creds_path = os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"]
        sheet_id = os.environ["GOOGLE_SHEET_ID"]
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        _client = gspread.authorize(creds)
        spreadsheet = _client.open_by_key(sheet_id)
        worksheet_name = os.getenv("GOOGLE_SHEET_TAB", "records")
        try:
            _sheet = spreadsheet.worksheet(worksheet_name)
        except gspread.WorksheetNotFound:
            _sheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(HEADER))
            _sheet.append_row(HEADER)
        return _sheet
    except Exception:  # noqa: BLE001
        logger.exception("Failed to initialize Google Sheets client.")
        return None


def append_record(tool: str, currency: str, inputs: dict, result_summary: str,
                   ai_summary: Optional[str] = None) -> bool:
    """Append one row. Returns True on success, False on any failure (never raises)."""
    sheet = _get_sheet()
    if sheet is None:
        logger.info("Sheets not configured; record not persisted: tool=%s", tool)
        return False
    try:
        row = [
            datetime.now(timezone.utc).isoformat(),
            tool,
            currency,
            str(inputs),
            result_summary,
            ai_summary or "",
        ]
        sheet.append_row(row)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Failed to append record to Google Sheets.")
        return False


def get_records(limit: int = 20) -> List[dict]:
    """Return the most recent records, newest first. Empty list if unavailable."""
    sheet = _get_sheet()
    if sheet is None:
        return []
    try:
        rows = sheet.get_all_records()  # list[dict] keyed by header row
        return list(reversed(rows))[:limit]
    except Exception:  # noqa: BLE001
        logger.exception("Failed to read records from Google Sheets.")
        return []
