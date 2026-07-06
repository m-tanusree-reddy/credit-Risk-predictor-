from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
from pathlib import Path

app = FastAPI(
    title="Credit Risk Predictor API"
)

BASE_DIR = Path(__file__).resolve().parent.parent
model = joblib.load(BASE_DIR / "models" / "credit_risk_model.pkl")


class Applicant(BaseModel):
    RevolvingUtilizationOfUnsecuredLines: float
    age: int
    NumberOfTime30_59DaysPastDueNotWorse: int
    DebtRatio: float
    MonthlyIncome: float
    NumberOfOpenCreditLinesAndLoans: int
    NumberOfTimes90DaysLate: int
    NumberRealEstateLoansOrLines: int
    NumberOfTime60_89DaysPastDueNotWorse: int
    NumberOfDependents: int
    IncomePerDependent: float


@app.get("/")
def root():
    return {"status": "running"}


@app.post("/predict")
def predict(applicant: Applicant):

    df = pd.DataFrame([{
        "RevolvingUtilizationOfUnsecuredLines":
        applicant.RevolvingUtilizationOfUnsecuredLines,

        "age":
        applicant.age,

        "NumberOfTime30-59DaysPastDueNotWorse":
        applicant.NumberOfTime30_59DaysPastDueNotWorse,

        "DebtRatio":
        applicant.DebtRatio,

        "MonthlyIncome":
        applicant.MonthlyIncome,

        "NumberOfOpenCreditLinesAndLoans":
        applicant.NumberOfOpenCreditLinesAndLoans,

        "NumberOfTimes90DaysLate":
        applicant.NumberOfTimes90DaysLate,

        "NumberRealEstateLoansOrLines":
        applicant.NumberRealEstateLoansOrLines,

        "NumberOfTime60-89DaysPastDueNotWorse":
        applicant.NumberOfTime60_89DaysPastDueNotWorse,

        "NumberOfDependents":
        applicant.NumberOfDependents,

        "IncomePerDependent":
        applicant.IncomePerDependent
    }])

    probability = float(
        model.predict_proba(df)[0][1]
    )

    if probability < 0.20:
        risk = "Low"
    elif probability < 0.50:
        risk = "Medium"
    else:
        risk = "High"

    return {
        "default_probability": probability,
        "risk_level": risk
    }
