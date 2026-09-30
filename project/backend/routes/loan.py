from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models.schemas import LoanRequest, LoanResponse
from services import claude_service, eligibility_service

logger = logging.getLogger("finova.routes.loan")
router = APIRouter(prefix="/api/loan", tags=["loan"])


@router.post("/check", response_model=LoanResponse)
def check_loan(req: LoanRequest) -> LoanResponse:
    try:
        result = eligibility_service.assess_loan(
            age=req.age,
            monthly_income=req.monthly_income,
            employment_type=req.employment_type,
            credit_score=req.credit_score,
            loan_amount=req.loan_amount,
            tenure_years=req.tenure_years,
            existing_monthly_debt=req.existing_monthly_debt,
        )
    except Exception:
        logger.exception("Loan eligibility calculation failed.")
        raise HTTPException(status_code=500, detail="Something went wrong while checking eligibility. Please try again.")

    ai_explanation = None
    if req.use_ai_explanation:
        summary_payload = {
            "currency": req.currency,
            "status": result["status"],
            "fit_score": result["fit_score"],
            "estimated_emi": result["estimated_emi"],
            "monthly_income": req.monthly_income,
            "credit_score": req.credit_score,
        }
        ai_explanation = claude_service.explain_loan_result(summary_payload)

    return LoanResponse(
        status=result["status"],
        fit_score=result["fit_score"],
        estimated_emi=result["estimated_emi"],
        indicative_max_loan=result["indicative_max_loan"],
        assumed_annual_rate=result["assumed_annual_rate"],
        currency=req.currency,
        factors=result["factors"],
        suggestions=result["suggestions"],
        ai_explanation=ai_explanation,
    )
