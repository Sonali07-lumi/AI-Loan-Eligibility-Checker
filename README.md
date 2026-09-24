# AI-Loan-Eligibility-Checker
AI-powered financial decision support web application that helps users check loan eligibility, analyze credit scores, calculate EMIs, and receive personalized financial tips. Built with modern web technologies, AI integration, multi-currency support, and a responsive interface

# FINOVA — AI-Powered Financial Decision Support

> **Smarter Financial Decisions, Powered by AI**

FINOVA is a full-stack AI-powered financial web application designed to help users understand and analyze different aspects of their personal finances through simple, interactive tools.

The platform brings four financial tools together in one interface:

- 💰 Loan Eligibility Checker
- 📊 Credit Score Analyzer
- 🧮 EMI Calculator
- 🤖 AI Financial Tips

FINOVA provides educational and general financial insights. It does **not** provide guaranteed loan approvals, official credit-bureau scores, or professional financial advice.

---

## ✨ Features

### 💰 Loan Eligibility Checker

Users can enter relevant financial information such as:

- Age
- Monthly income
- Employment type
- Credit score
- Desired loan amount
- Loan tenure
- Existing loans/debt

FINOVA processes the information and provides an **estimated eligibility assessment** with factors such as:

- Estimated eligibility status
- Income assessment
- Credit score assessment
- Employment assessment
- Debt/loan assessment
- Loan amount considerations
- General suggestions
- AI-generated explanation when available

> ⚠️ The result is an educational estimate and is not an official bank decision.

---

### 📊 Credit Score Analyzer

Users can enter their existing credit score and receive a general interpretation.

The analyzer provides:

- Score interpretation
- General risk-related insights
- Positive factors
- Areas that may need attention
- AI-generated explanation

The platform clearly distinguishes between:

**User-provided credit score**

and

**AI-generated interpretation**

FINOVA does not generate or claim to provide an official credit-bureau score.

---

### 🧮 EMI Calculator

A real-time EMI calculator that works directly in the browser.

Users can enter:

- Loan amount
- Interest rate
- Loan tenure

The calculator provides:

- Monthly EMI
- Total principal
- Total interest
- Total repayment

It uses the standard reducing-balance EMI formula.

---

### 🤖 AI Financial Tips

Users can provide:

- Financial goal
- Monthly income
- Monthly expenses
- Current savings
- Optional question/context

The AI can provide:

- Financial insights
- Budgeting suggestions
- Saving ideas
- Practical suggestions
- General risk awareness

AI requests are processed through the secure backend rather than exposing the API key in frontend code.

---

## 💱 Multi-Currency Support

FINOVA is designed as a multi-currency financial platform.

Supported currencies include:

- 🇮🇳 INR — Indian Rupee (₹)
- 🇺🇸 USD — US Dollar ($)
- 🇪🇺 EUR — Euro (€)
- 🇬🇧 GBP — British Pound (£)
- 🇯🇵 JPY — Japanese Yen (¥)
- 🇦🇺 AUD — Australian Dollar
- 🇨🇦 CAD — Canadian Dollar
- 🇸🇬 SGD — Singapore Dollar
- 🇦🇪 AED — UAE Dirham
- 🇨🇭 CHF — Swiss Franc

The selected currency is used consistently across monetary inputs and outputs.

Financial input fields remain empty by default and use placeholders instead of fake values.

For example:

```text
Monthly Income
[Enter your monthly income]
