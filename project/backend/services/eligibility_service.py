"""
Pure, deterministic financial rules — no I/O, no external calls.

Kept separate from routes/services that touch Claude or Google Sheets so the
core business logic is trivial to unit test.
"""
from __future__ import annotations

from typing import List, Tuple

from models.schemas import EmploymentType, LoanFactor

ASSUMED_ANNUAL_RATE = 10.5  # indicative rate used only for illustration


def emi(principal: float, annual_rate: float, months: int) -> float:
    """Standard reducing-balance EMI formula."""
    if months <= 0:
        return 0.0
    monthly_rate = annual_rate / 1200
    if monthly_rate == 0:
        return principal / months
    factor = (1 + monthly_rate) ** months
    return principal * monthly_rate * factor / (factor - 1)


def total_repayment(principal: float, annual_rate: float, months: int) -> Tuple[float, float]:
    e = emi(principal, annual_rate, months)
    total = e * months
    return total, total - principal


def present_value_from_emi(available_emi: float, annual_rate: float, months: int) -> float:
    """Inverse of emi(): how large a loan a given monthly payment supports."""
    if months <= 0 or available_emi <= 0:
        return 0.0
    monthly_rate = annual_rate / 1200
    if monthly_rate == 0:
        return available_emi * months
    factor = (1 + monthly_rate) ** months
    return available_emi * (factor - 1) / (monthly_rate * factor)


def _level(points: float, max_points: float) -> str:
    ratio = points / max_points if max_points else 0
    if ratio >= 0.75:
        return "good"
    if ratio >= 0.4:
        return "mid"
    return "low"


EMPLOYMENT_POINTS = {
    EmploymentType.salaried: (10, "Stable salaried income is generally viewed favourably."),
    EmploymentType.retired: (8, "Pension income is steady, though lenders may look at age and tenure."),
    EmploymentType.self_employed: (7, "Self-employed applicants usually need income proof over several years."),
    EmploymentType.business: (7, "Business income is assessed on documented profits and history."),
    EmploymentType.unemployed: (0, "Without regular income, unsecured credit is unlikely to be approved."),
}


def assess_loan(
    age: int,
    monthly_income: float,
    employment_type: EmploymentType,
    credit_score: int,
    loan_amount: float,
    tenure_years: int,
    existing_monthly_debt: float,
) -> dict:
    months = tenure_years * 12
    estimated_emi = emi(loan_amount, ASSUMED_ANNUAL_RATE, months)
    ratio = (existing_monthly_debt + estimated_emi) / monthly_income
    income_multiple = loan_amount / (monthly_income * 12)

    factors: List[LoanFactor] = []
    score = 0.0

    # Credit score — up to 40 points
    if credit_score >= 750:
        pts, detail = 40, "Your score is in a range lenders usually view favourably."
    elif credit_score >= 700:
        pts, detail = 32, "Your score is in a range lenders usually view favourably."
    elif credit_score >= 650:
        pts, detail = 22, "A fair score may lead to higher rates or extra checks."
    elif credit_score >= 600:
        pts, detail = 12, "A lower score can limit approval or raise the rate."
    else:
        pts, detail = 4, "A lower score can limit approval or raise the rate."
    score += pts
    factors.append(LoanFactor(label="Credit score", level=_level(pts, 40), detail=detail))

    # Debt-to-income — up to 40 points
    if ratio <= 0.35:
        pts = 40
    elif ratio <= 0.45:
        pts = 30
    elif ratio <= 0.55:
        pts = 18
    elif ratio <= 0.65:
        pts = 8
    else:
        pts = 0
    score += pts
    factors.append(LoanFactor(
        label="Debt and income",
        level=_level(pts, 40),
        detail=f"With this loan, about {ratio * 100:.0f}% of your income would go to loan payments. "
               f"Lenders often prefer 40-50% or less.",
    ))

    # Employment — up to 10 points
    emp_pts, emp_detail = EMPLOYMENT_POINTS[employment_type]
    score += emp_pts
    factors.append(LoanFactor(label="Employment", level=_level(emp_pts, 10), detail=emp_detail))

    # Age / tenure fit — up to 10 points
    maturity_age = age + tenure_years
    if age < 21 or age > 60:
        age_pts = 3
    else:
        age_pts = 10
    if maturity_age > 70:
        age_pts = max(0, age_pts - 5)
    age_detail = (
        f"The loan would end at age {maturity_age}, which many lenders limit."
        if maturity_age > 70 else "Your age and tenure fit typical lending windows."
    )
    score += age_pts
    factors.append(LoanFactor(label="Age and tenure", level=_level(age_pts, 10), detail=age_detail))

    # Loan size vs income (informational, not scored)
    size_level = "good" if income_multiple <= 3 else "mid" if income_multiple <= 5 else "low"
    factors.append(LoanFactor(
        label="Loan size",
        level=size_level,
        detail=f"The loan is about {income_multiple:.1f}x your annual income.",
    ))

    if employment_type == EmploymentType.unemployed:
        score = min(score, 45)

    if score >= 75:
        status = "likely_eligible"
    elif score >= 50:
        status = "possibly_eligible"
    else:
        status = "unlikely_eligible"

    suggestions = []
    if credit_score < 700:
        suggestions.append("Raise your score with on-time payments and lower card utilization.")
    if ratio > 0.45:
        suggestions.append("Reduce existing payments, or choose a smaller amount or a longer tenure.")
    if maturity_age > 70:
        suggestions.append("Pick a shorter tenure so the loan ends earlier in life.")
    if not suggestions:
        suggestions.append("Compare rates across several lenders before applying.")

    available_emi = max(0.0, monthly_income * 0.4 - existing_monthly_debt)
    indicative_max_loan = present_value_from_emi(available_emi, ASSUMED_ANNUAL_RATE, months)

    return {
        "status": status,
        "fit_score": round(score),
        "estimated_emi": round(estimated_emi, 2),
        "indicative_max_loan": round(indicative_max_loan, 2),
        "assumed_annual_rate": ASSUMED_ANNUAL_RATE,
        "factors": factors,
        "suggestions": suggestions,
    }


CREDIT_BANDS = [
    (800, "Excellent", "good", "Lenders typically offer their best terms."),
    (750, "Very good", "good", "Most lenders view this as low risk."),
    (700, "Good", "good", "Generally acceptable, with competitive offers likely."),
    (650, "Fair", "mid", "Approval is possible, but rates may be higher."),
    (550, "Poor", "low", "Approval is harder and costs are usually higher."),
    (300, "Very poor", "low", "Most mainstream lenders may decline; rebuilding credit is the priority."),
]


def assess_credit(
    credit_score: int,
    utilization_pct: float | None,
    on_time_payment_pct: float | None,
    credit_history_years: float | None,
    recent_applications: int | None,
) -> dict:
    band = next(b for b in CREDIT_BANDS if credit_score >= b[0])
    positive: List[str] = []
    attention: List[str] = []

    if utilization_pct is not None:
        if utilization_pct <= 30:
            positive.append(f"Utilization of {utilization_pct:.0f}% is within the commonly recommended 30%.")
        else:
            attention.append(f"Utilization of {utilization_pct:.0f}% is high; aim to stay under 30% of your limits.")

    if on_time_payment_pct is not None:
        if on_time_payment_pct >= 98:
            positive.append("Almost all payments were on time — the biggest driver of credit scores.")
        elif on_time_payment_pct < 95:
            attention.append(f"Only {on_time_payment_pct:.0f}% of payments were on time; missed payments weigh heavily.")

    if credit_history_years is not None:
        if credit_history_years >= 7:
            positive.append(f"A {credit_history_years:.0f}-year history shows long-term credit management.")
        elif credit_history_years < 3:
            attention.append(f"A {credit_history_years:.0f}-year history is short; keep older accounts open.")

    if recent_applications is not None:
        if recent_applications <= 2:
            positive.append("Few recent applications keeps credit-seeking risk signals low.")
        elif recent_applications >= 5:
            attention.append(f"{recent_applications} recent applications may signal credit-seeking; space future ones out.")

    return {
        "band": band[1],
        "band_level": band[2],
        "band_detail": band[3],
        "positive_factors": positive or ["Nothing flagged as positive from the details provided."],
        "attention_factors": attention or ["Nothing flagged from the details provided."],
    }


def budget_split(monthly_income: float) -> Tuple[float, float, float]:
    """50/30/20 needs/wants/savings split."""
    return monthly_income * 0.5, monthly_income * 0.3, monthly_income * 0.2
