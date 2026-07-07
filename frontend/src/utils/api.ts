import { ApplicantData, predictCreditRisk, PredictionResult } from "./randomForest";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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
  const explanation = predictCreditRisk(applicant);
  const score = Math.round(Number(result.default_probability) * 1000) / 10;

  return {
    ...explanation,
    score,
    riskLevel: normalizeRiskLevel(result.risk_level),
  };
}
