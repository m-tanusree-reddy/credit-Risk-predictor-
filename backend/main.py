from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import joblib
import numpy as np
from pathlib import Path
from datetime import datetime
import io


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


def map_columns(headers):
    col_map = {}
    lower_headers = [h.lower() for h in headers]
    
    # Core features
    util_idx = next((i for i, h in enumerate(lower_headers) if "util" in h or "revolving" in h or "percent" in h), -1)
    if util_idx != -1: col_map["RevolvingUtilizationOfUnsecuredLines"] = headers[util_idx]
        
    age_idx = next((i for i, h in enumerate(lower_headers) if "age" in h), -1)
    if age_idx != -1: col_map["age"] = headers[age_idx]

    late30_idx = next((i for i, h in enumerate(lower_headers) if "30" in h or "late30" in h), -1)
    if late30_idx != -1: col_map["NumberOfTime30-59DaysPastDueNotWorse"] = headers[late30_idx]

    debt_idx = next((i for i, h in enumerate(lower_headers) if "debt" in h or "ratio" in h), -1)
    if debt_idx != -1: col_map["DebtRatio"] = headers[debt_idx]

    inc_idx = next((i for i, h in enumerate(lower_headers) if "income" in h or "salary" in h), -1)
    if inc_idx != -1: col_map["MonthlyIncome"] = headers[inc_idx]

    open_idx = next((i for i, h in enumerate(lower_headers) if "open" in h or ("line" in h and not any(x in h for x in ["revolving", "real", "estate"]))), -1)
    if open_idx != -1: col_map["NumberOfOpenCreditLinesAndLoans"] = headers[open_idx]

    late90_idx = next((i for i, h in enumerate(lower_headers) if "90" in h or "late90" in h or "severe" in h), -1)
    if late90_idx != -1: col_map["NumberOfTimes90DaysLate"] = headers[late90_idx]

    re_idx = next((i for i, h in enumerate(lower_headers) if "real" in h or "estate" in h or "mortgage" in h), -1)
    if re_idx != -1: col_map["NumberRealEstateLoansOrLines"] = headers[re_idx]

    late60_idx = next((i for i, h in enumerate(lower_headers) if "60" in h or "late60" in h), -1)
    if late60_idx != -1: col_map["NumberOfTime60-89DaysPastDueNotWorse"] = headers[late60_idx]

    dep_idx = next((i for i, h in enumerate(lower_headers) if "dependent" in h or "dep" in h), -1)
    if dep_idx != -1: col_map["NumberOfDependents"] = headers[dep_idx]

    # Optional metadata
    name_idx = next((i for i, h in enumerate(lower_headers) if ("name" in h and "unnamed" not in h) or "applicant" in h), -1)
    amt_idx = next((i for i, h in enumerate(lower_headers) if "amount" in h or "requested" in h or "loan_amt" in h), -1)
    purpose_idx = next((i for i, h in enumerate(lower_headers) if "purpose" in h), -1)
    duration_idx = next((i for i, h in enumerate(lower_headers) if "duration" in h or "month" in h), -1)
    
    extra_cols = {}
    if name_idx != -1: extra_cols["name"] = headers[name_idx]
    if amt_idx != -1: extra_cols["loanAmount"] = headers[amt_idx]
    if purpose_idx != -1: extra_cols["loanPurpose"] = headers[purpose_idx]
    if duration_idx != -1: extra_cols["loanDuration"] = headers[duration_idx]

    return col_map, extra_cols


@app.post("/predict-batch")
async def predict_batch(file: UploadFile = File(...)):
    try:
        # Read uploaded CSV
        content = await file.read()
        df_raw = pd.read_csv(io.BytesIO(content))
        
        if df_raw.empty:
            return JSONResponse(status_code=400, content={"error": "The uploaded CSV file is empty."})
            
        # Cap to first 500 rows to ensure fast execution and prevent timeouts
        if len(df_raw) > 500:
            df_raw = df_raw.head(500)
            
        headers = df_raw.columns.tolist()
        col_map, extra_cols = map_columns(headers)
        
        required_features = [
            "RevolvingUtilizationOfUnsecuredLines",
            "age",
            "NumberOfTime30-59DaysPastDueNotWorse",
            "DebtRatio",
            "MonthlyIncome",
            "NumberOfOpenCreditLinesAndLoans",
            "NumberOfTimes90DaysLate",
            "NumberRealEstateLoansOrLines",
            "NumberOfTime60-89DaysPastDueNotWorse",
            "NumberOfDependents"
        ]
        
        missing = [feat for feat in required_features if feat not in col_map]
        if missing:
            friendly_names = {
                "RevolvingUtilizationOfUnsecuredLines": "Credit Utilization (e.g. 'utilization')",
                "age": "Age",
                "NumberOfTime30-59DaysPastDueNotWorse": "Late 30-59 Days (e.g. 'late30')",
                "DebtRatio": "Debt Ratio",
                "MonthlyIncome": "Monthly Income (e.g. 'income')",
                "NumberOfOpenCreditLinesAndLoans": "Open Credit Lines (e.g. 'open')",
                "NumberOfTimes90DaysLate": "Late 90+ Days (e.g. 'late90')",
                "NumberRealEstateLoansOrLines": "Real Estate Loans (e.g. 'mortgage')",
                "NumberOfTime60-89DaysPastDueNotWorse": "Late 60-89 Days (e.g. 'late60')",
                "NumberOfDependents": "Number of Dependents"
            }
            missing_friendly = [friendly_names.get(m, m) for m in missing]
            return JSONResponse(
                status_code=400,
                content={"error": f"Missing required columns in CSV: {', '.join(missing_friendly)}"}
            )
            
        # Build model DataFrame
        df_model = pd.DataFrame()
        for model_feat, csv_col in col_map.items():
            df_model[model_feat] = df_raw[csv_col]
            
        # Fill missing values if any
        df_model = df_model.fillna({
            "RevolvingUtilizationOfUnsecuredLines": 0.3,
            "age": 45,
            "NumberOfTime30-59DaysPastDueNotWorse": 0,
            "DebtRatio": 0.35,
            "MonthlyIncome": 6000.0,
            "NumberOfOpenCreditLinesAndLoans": 8,
            "NumberOfTimes90DaysLate": 0,
            "NumberRealEstateLoansOrLines": 1,
            "NumberOfTime60-89DaysPastDueNotWorse": 0,
            "NumberOfDependents": 0
        })
        
        # Check if utilization values are in percentages (e.g. > 1.0) and convert to decimal
        util_vals = df_model["RevolvingUtilizationOfUnsecuredLines"].astype(float)
        df_model["RevolvingUtilizationOfUnsecuredLines"] = np.where(util_vals > 1.0, util_vals / 100.0, util_vals)
        
        # Calculate IncomePerDependent
        df_model["IncomePerDependent"] = df_model["MonthlyIncome"] / (df_model["NumberOfDependents"] + 1)
        
        # Reorder columns to match training set EXACTLY
        feature_order = [
            "RevolvingUtilizationOfUnsecuredLines",
            "age",
            "NumberOfTime30-59DaysPastDueNotWorse",
            "DebtRatio",
            "MonthlyIncome",
            "NumberOfOpenCreditLinesAndLoans",
            "NumberOfTimes90DaysLate",
            "NumberRealEstateLoansOrLines",
            "NumberOfTime60-89DaysPastDueNotWorse",
            "NumberOfDependents",
            "IncomePerDependent"
        ]
        df_model = df_model[feature_order]
        
        # Vectorized probability prediction
        probabilities = model.predict_proba(df_model)[:, 1]
        
        # Construct output JSON records
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        results = []
        
        for idx in range(len(df_raw)):
            row_raw = df_raw.iloc[idx]
            prob = float(probabilities[idx])
            
            # Risk labeling
            if prob < 0.20:
                risk = "LOW"
            elif prob < 0.50:
                risk = "MEDIUM"
            else:
                risk = "HIGH"
                
            # Reconstruct details
            name_col = extra_cols.get("name")
            name = str(row_raw[name_col]) if name_col and pd.notna(row_raw[name_col]) else f"Applicant #{idx + 1}"
            
            amt_col = extra_cols.get("loanAmount")
            loan_amt = float(row_raw[amt_col]) if amt_col and pd.notna(row_raw[amt_col]) else None
            
            purpose_col = extra_cols.get("loanPurpose")
            loan_purpose = str(row_raw[purpose_col]) if purpose_col and pd.notna(row_raw[purpose_col]) else None
            
            duration_col = extra_cols.get("loanDuration")
            loan_duration = int(row_raw[duration_col]) if duration_col and pd.notna(row_raw[duration_col]) else None
            
            # Convert values back to frontend representation
            applicant_details = {
                "id": f"APP-B{1000 + idx + 1}",
                "name": name,
                "age": int(row_raw[col_map["age"]]) if pd.notna(row_raw[col_map["age"]]) else 45,
                "income": float(row_raw[col_map["MonthlyIncome"]]) if pd.notna(row_raw[col_map["MonthlyIncome"]]) else 6000.0,
                "dependents": int(row_raw[col_map["NumberOfDependents"]]) if pd.notna(row_raw[col_map["NumberOfDependents"]]) else 0,
                "debtRatio": float(row_raw[col_map["DebtRatio"]]) if pd.notna(row_raw[col_map["DebtRatio"]]) else 0.35,
                "openCreditLines": int(row_raw[col_map["NumberOfOpenCreditLinesAndLoans"]]) if pd.notna(row_raw[col_map["NumberOfOpenCreditLinesAndLoans"]]) else 8,
                "realEstateLoans": int(row_raw[col_map["NumberRealEstateLoansOrLines"]]) if pd.notna(row_raw[col_map["NumberRealEstateLoansOrLines"]]) else 1,
                "creditUtilization": float(row_raw[col_map["RevolvingUtilizationOfUnsecuredLines"]]) if pd.notna(row_raw[col_map["RevolvingUtilizationOfUnsecuredLines"]]) else 30.0,
                "late3059": int(row_raw[col_map["NumberOfTime30-59DaysPastDueNotWorse"]]) if pd.notna(row_raw[col_map["NumberOfTime30-59DaysPastDueNotWorse"]]) else 0,
                "late6089": int(row_raw[col_map["NumberOfTime60-89DaysPastDueNotWorse"]]) if pd.notna(row_raw[col_map["NumberOfTime60-89DaysPastDueNotWorse"]]) else 0,
                "late90Plus": int(row_raw[col_map["NumberOfTimes90DaysLate"]]) if pd.notna(row_raw[col_map["NumberOfTimes90DaysLate"]]) else 0,
                "date": timestamp
            }
            
            if loan_amt is not None: applicant_details["loanAmount"] = loan_amt
            if loan_purpose is not None: applicant_details["loanPurpose"] = loan_purpose
            if loan_duration is not None: applicant_details["loanDuration"] = loan_duration
            
            # Ensure creditUtilization is percentage-based (e.g. 0.35 -> 35.0, or 35.0 -> 35.0)
            if applicant_details["creditUtilization"] <= 1.0:
                applicant_details["creditUtilization"] *= 100.0
                
            results.append({
                "id": f"APP-B{1000 + idx + 1}",
                "applicant": applicant_details,
                "prediction": {
                    "score": round(prob * 100, 1),
                    "riskLevel": risk,
                    "baseValue": round(model_base_value * 100, 1),
                    "shapValues": {}
                },
                "date": timestamp
            })
            
        return results
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to process CSV file: {str(e)}"})
