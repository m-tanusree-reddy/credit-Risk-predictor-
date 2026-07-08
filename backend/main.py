from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import numpy as np
from pathlib import Path

app = FastAPI(
    title="Credit Risk Predictor API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
model = joblib.load(BASE_DIR / "models" / "credit_risk_model.pkl")

# Pre-calculate base value at startup (average expected default probability at root)
base_values = []
for est in model.estimators_:
    val = est.tree_.value[0]
    if len(val.shape) == 3:  # (node_count, 1, n_classes)
        prob_root = val[0][0][1] / np.sum(val[0][0])
    else:
        prob_root = val[0][1] / np.sum(val[0])
    base_values.append(prob_root)
model_base_value = float(np.mean(base_values))


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

    # Compute local feature contributions (like SHAP values)
    feature_names = df.columns.tolist()
    contributions = {feat: 0.0 for feat in feature_names}
    n_estimators = len(model.estimators_)

    for est in model.estimators_:
        tree = est.tree_
        node_indicator = est.decision_path(df)
        path = node_indicator.indices[node_indicator.indptr[0]:node_indicator.indptr[1]]

        if len(tree.value.shape) == 3:
            node_probs = tree.value[:, 0, 1] / np.sum(tree.value[:, 0, :], axis=1)
        else:
            node_probs = tree.value[:, 1] / np.sum(tree.value, axis=1)

        for idx in range(len(path) - 1):
            parent_node = path[idx]
            child_node = path[idx + 1]
            split_feature_idx = tree.feature[parent_node]
            if split_feature_idx >= 0:
                split_feature_name = feature_names[split_feature_idx]
                delta = node_probs[child_node] - node_probs[parent_node]
                contributions[split_feature_name] += delta / n_estimators

    # Convert contributions to native python floats for JSON serialization
    shap_values = {feat: float(val) for feat, val in contributions.items()}

    return {
        "default_probability": probability,
        "risk_level": risk,
        "base_value": model_base_value,
        "shap_values": shap_values
    }
