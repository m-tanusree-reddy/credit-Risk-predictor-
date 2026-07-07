import streamlit as st
import requests

st.title("💳 Credit Risk Predictor")

st.subheader("Applicant Information")

util = st.number_input(
    "Revolving Utilization",
    min_value=0.0,
    value=0.5
)

age = st.number_input(
    "Age",
    min_value=18,
    value=30
)

income = st.number_input(
    "Monthly Income",
    min_value=0.0,
    value=5000.0
)

debt_ratio = st.number_input(
    "Debt Ratio",
    min_value=0.0,
    value=0.5
)

dependents = st.number_input(
    "Dependents",
    min_value=0,
    value=0
)

income_per_dep = income / (dependents + 1)

late_30 = st.number_input(
    "30-59 Days Late",
    min_value=0,
    value=0
)

late_60 = st.number_input(
    "60-89 Days Late",
    min_value=0,
    value=0
)

late_90 = st.number_input(
    "90+ Days Late",
    min_value=0,
    value=0
)

open_lines = st.number_input(
    "Open Credit Lines",
    min_value=0,
    value=5
)

real_estate = st.number_input(
    "Real Estate Loans",
    min_value=0,
    value=1
)

if st.button("Predict Risk"):

    payload = {
        "RevolvingUtilizationOfUnsecuredLines": util,
        "age": age,
        "NumberOfTime30_59DaysPastDueNotWorse": late_30,
        "DebtRatio": debt_ratio,
        "MonthlyIncome": income,
        "NumberOfOpenCreditLinesAndLoans": open_lines,
        "NumberOfTimes90DaysLate": late_90,
        "NumberRealEstateLoansOrLines": real_estate,
        "NumberOfTime60_89DaysPastDueNotWorse": late_60,
        "NumberOfDependents": dependents,
        "IncomePerDependent": income_per_dep
    }

    response = requests.post(
        "http://127.0.0.1:8000/predict",
        json=payload
    )

    result = response.json()

    st.success(
        f"Risk Level: {result['risk_level']}"
    )

    st.metric(
        "Default Probability",
        f"{result['default_probability']*100:.2f}%"
    )
