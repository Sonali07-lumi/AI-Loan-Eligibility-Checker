from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models.schemas import TipsRequest, TipsResponse
from services import claude_service, eligibility_service

logger = logging.getLogger("finova.routes.tips")
router = APIRouter(prefix="/api", tags=["tips"])

FALLBACK_TEMPLATE = (
    "Here is a general starting point based on your numbers:\n\n"
    "- You have about {surplus} left each month after expenses.\n"
    "- Consider building an emergency fund of 3-6 months of expenses "
    "({low} to {high}) before other goals.\n"
    "- Automate a transfer toward \"{goal}\" on payday so saving happens "
    "before spending.\n\n"
    "This is general educational information, not personalized financial advice."
)


@router.post("/financial-tips", response_model=TipsResponse)
def financial_tips(req: TipsRequest) -> TipsResponse:
    try:
        needs, wants, savings = eligibility_service.budget_split(req.monthly_income)
        surplus = req.monthly_income - req.monthly_expenses
    except Exception:
        logger.exception("Budget split calculation failed.")
        raise HTTPException(status_code=500, detail="Something went wrong while generating your insights. Please try again.")

    payload = {
        "currency": req.currency,
        "financial_goal": req.financial_goal,
        "monthly_income": req.monthly_income,
        "monthly_expenses": req.monthly_expenses,
        "current_savings": req.current_savings,
        "goal_target_amount": req.goal_target_amount,
        "question": req.question,
    }

    ai_text = claude_service.generate_financial_tips(payload)
    if ai_text:
        return TipsResponse(
            currency=req.currency,
            needs_budget=round(needs, 2),
            wants_budget=round(wants, 2),
            savings_budget=round(savings, 2),
            ai_insights=ai_text,
            source="claude",
        )

    fallback = FALLBACK_TEMPLATE.format(
        surplus=f"{surplus:,.0f} {req.currency}",
        low=f"{req.monthly_expenses * 3:,.0f} {req.currency}",
        high=f"{req.monthly_expenses * 6:,.0f} {req.currency}",
        goal=req.financial_goal,
    )
    return TipsResponse(
        currency=req.currency,
        needs_budget=round(needs, 2),
        wants_budget=round(wants, 2),
        savings_budget=round(savings, 2),
        ai_insights=fallback,
        source="fallback",
    )
