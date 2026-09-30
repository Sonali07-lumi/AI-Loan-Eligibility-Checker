"""
Pydantic models shared by every route.

Keeping all request/response shapes in one place makes it easy to see the
full public contract of the API at a glance, and keeps routes/services thin.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"]


class EmploymentType(str, Enum):
    salaried = "salaried"
    self_employed = "self"
    business = "business"
    retired = "retired"
    unemployed = "unemployed"


class CurrencyMixin(BaseModel):
    currency: str = Field(default="INR", description="ISO-ish currency code used for all amounts in this request")

    @field_validator("currency")
    @classmethod
    def _valid_currency(cls, v: str) -> str:
        v = (v or "INR").upper()
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency '{v}'. Supported: {', '.join(SUPPORTED_CURRENCIES)}")
        return v


# ---------------------------------------------------------------- loan -----
class LoanRequest(CurrencyMixin):
    age: int = Field(..., ge=18, le=70)
    monthly_income: float = Field(..., gt=0)
    employment_type: EmploymentType
    credit_score: int = Field(..., ge=300, le=900)
    loan_amount: float = Field(..., gt=0)
    tenure_years: int = Field(..., ge=1, le=30)
    existing_monthly_debt: float = Field(default=0, ge=0)
    use_ai_explanation: bool = Field(default=True)


class LoanFactor(BaseModel):
    label: str
    level: str  # good | mid | low
    detail: str


class LoanResponse(BaseModel):
    status: str  # likely_eligible | possibly_eligible | unlikely_eligible
    fit_score: int
    estimated_emi: float
    indicative_max_loan: float
    assumed_annual_rate: float
    currency: str
    factors: List[LoanFactor]
    suggestions: List[str]
    ai_explanation: Optional[str] = None
    disclaimer: str = (
        "This is an educational estimate based on project rules, not an official bank decision."
    )


# -------------------------------------------------------------- credit -----
class CreditRequest(CurrencyMixin):
    credit_score: int = Field(..., ge=300, le=900)
    utilization_pct: Optional[float] = Field(default=None, ge=0, le=100)
    on_time_payment_pct: Optional[float] = Field(default=None, ge=0, le=100)
    credit_history_years: Optional[float] = Field(default=None, ge=0, le=60)
    recent_applications: Optional[int] = Field(default=None, ge=0, le=50)
    use_ai_explanation: bool = Field(default=True)


class CreditResponse(BaseModel):
    user_provided_score: int
    band: str
    band_level: str  # good | mid | low
    band_detail: str
    positive_factors: List[str]
    attention_factors: List[str]
    ai_explanation: Optional[str] = None
    disclaimer: str = (
        "This is an AI/rule-based interpretation, not an official credit-bureau score."
    )


# ------------------------------------------------------------------ tips ---
class TipsRequest(CurrencyMixin):
    financial_goal: str = Field(..., min_length=2, max_length=200)
    monthly_income: float = Field(..., gt=0)
    monthly_expenses: float = Field(..., ge=0)
    current_savings: float = Field(default=0, ge=0)
    goal_target_amount: Optional[float] = Field(default=None, gt=0)
    question: Optional[str] = Field(default=None, max_length=500)


class TipsResponse(BaseModel):
    currency: str
    needs_budget: float
    wants_budget: float
    savings_budget: float
    ai_insights: str
    source: str  # "claude" | "fallback"
    disclaimer: str = "General educational information, not professional financial advice."


# --------------------------------------------------------------- records ---
class RecordIn(BaseModel):
    tool: str = Field(..., pattern="^(loan|credit|emi|tips)$")
    currency: str
    inputs: dict
    result_summary: str
    ai_summary: Optional[str] = None


class RecordOut(RecordIn):
    timestamp: datetime


class HealthResponse(BaseModel):
    status: str
    claude_configured: bool
    sheets_configured: bool
