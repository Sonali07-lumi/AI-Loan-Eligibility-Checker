from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models.schemas import CreditRequest, CreditResponse
from services import claude_service, eligibility_service

logger = logging.getLogger("finova.routes.credit")
router = APIRouter(prefix="/api/credit", tags=["credit"])


@router.post("/analyze", response_model=CreditResponse)
def analyze_credit(req: CreditRequest) -> CreditResponse:
    try:
        result = eligibility_service.assess_credit(
            credit_score=req.credit_score,
            utilization_pct=req.utilization_pct,
            on_time_payment_pct=req.on_time_payment_pct,
            credit_history_years=req.credit_history_years,
            recent_applications=req.recent_applications,
        )
    except Exception:
        logger.exception("Credit analysis failed.")
        raise HTTPException(status_code=500, detail="Something went wrong while analyzing your score. Please try again.")

    ai_explanation = None
    if req.use_ai_explanation:
        payload = {
            "currency": req.currency,
            "credit_score": req.credit_score,
            "band": result["band"],
            "utilization_pct": req.utilization_pct,
            "on_time_payment_pct": req.on_time_payment_pct,
        }
        ai_explanation = claude_service.explain_credit_result(payload)

    return CreditResponse(
        user_provided_score=req.credit_score,
        band=result["band"],
        band_level=result["band_level"],
        band_detail=result["band_detail"],
        positive_factors=result["positive_factors"],
        attention_factors=result["attention_factors"],
        ai_explanation=ai_explanation,
    )
