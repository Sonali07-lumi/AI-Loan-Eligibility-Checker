from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from models.schemas import RecordIn
from services import sheets_service

logger = logging.getLogger("finova.routes.records")
router = APIRouter(prefix="/api/records", tags=["records"])


@router.post("/save")
def save_record(record: RecordIn) -> dict:
    if not sheets_service.is_configured():
        # Not a hard failure: the frontend can keep working from browser storage.
        return {"saved": False, "reason": "Google Sheets is not configured on the server."}
    try:
        ok = sheets_service.append_record(
            tool=record.tool,
            currency=record.currency,
            inputs=record.inputs,
            result_summary=record.result_summary,
            ai_summary=record.ai_summary,
        )
    except Exception:
        logger.exception("Unexpected error saving record.")
        raise HTTPException(status_code=502, detail="Could not save this record right now. Please try again.")
    return {"saved": ok}


@router.get("")
def list_records(limit: int = Query(default=20, ge=1, le=100)) -> dict:
    if not sheets_service.is_configured():
        return {"records": [], "configured": False}
    try:
        rows = sheets_service.get_records(limit=limit)
    except Exception:
        logger.exception("Unexpected error reading records.")
        raise HTTPException(status_code=502, detail="Could not load recent records right now. Please try again.")
    return {"records": rows, "configured": True}
