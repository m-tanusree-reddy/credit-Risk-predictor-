import { ApplicantData, predictCreditRisk, PredictionResult } from "./randomForest";
import { AssessmentRecord } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

export function toBackendPayload(applicant: ApplicantData) {
  return {
    RevolvingUtilizationOfUnsecuredLines: applicant.creditUtilization / 100,
    age: applicant.age,
    NumberOfTime30_59DaysPastDueNotWorse: applicant.late3059,
    DebtRatio: applicant.debtRatio,
    MonthlyIncome: applicant.income,
    NumberOfOpenCreditLinesAndLoans: applicant.openCreditLines,
    NumberOfTimes90DaysLate: applicant.late90Plus,
    NumberRealEstateLoansOrLines: applicant.realEstateLoans,
    NumberOfTime60_89DaysPastDueNotWorse: applicant.late6089,
    NumberOfDependents: applicant.dependents,
    IncomePerDependent: applicant.income / (applicant.dependents + 1),
  };
}

function normalizeRiskLevel(level: string): PredictionResult["riskLevel"] {
  const upper = level.toUpperCase();
  if (upper === "LOW" || upper === "MEDIUM" || upper === "HIGH" || upper === "CRITICAL") {
    return upper;
  }
  return "MEDIUM";
}

export async function predictApplicant(applicant: ApplicantData): Promise<PredictionResult> {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toBackendPayload(applicant)),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Credit risk API request failed.");
  }

  const result = await response.json();
  const score = Math.round(Number(result.default_probability) * 1000) / 10;
  const baseValue = Math.round(Number(result.base_value) * 1000) / 10;

  const keyMapping: Record<string, string> = {
    "RevolvingUtilizationOfUnsecuredLines": "creditUtilization",
    "age": "age",
    "NumberOfTime30-59DaysPastDueNotWorse": "late3059",
    "DebtRatio": "debtRatio",
    "MonthlyIncome": "income",
    "NumberOfOpenCreditLinesAndLoans": "openCreditLines",
    "NumberOfTimes90DaysLate": "late90Plus",
    "NumberRealEstateLoansOrLines": "realEstateLoans",
    "NumberOfTime60-89DaysPastDueNotWorse": "late6089",
    "NumberOfDependents": "dependents",
    "IncomePerDependent": "incomePerDependent"
  };

  const shapValues: Record<string, number> = {};
  if (result.shap_values) {
    Object.entries(result.shap_values).forEach(([key, val]) => {
      const frontendKey = keyMapping[key] || key;
      shapValues[frontendKey] = Math.round(Number(val) * 1000) / 10;
    });
  }

  return {
    score,
    riskLevel: normalizeRiskLevel(result.risk_level),
    baseValue,
    shapValues,
  };
}

export async function predictBatch(file: File): Promise<AssessmentRecord[]> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/predict-batch`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const message = errorJson.error || await response.text();
    throw new Error(message || "Batch credit risk assessment failed.");
  }

  const results = await response.json();
  
  return results.map((item: any) => {
    return {
      id: item.id,
      applicant: item.applicant,
      prediction: {
        score: item.prediction.score,
        riskLevel: normalizeRiskLevel(item.prediction.riskLevel),
        baseValue: item.prediction.baseValue,
        shapValues: item.prediction.shapValues,
      },
      date: item.date,
    } as AssessmentRecord;
  });
}

