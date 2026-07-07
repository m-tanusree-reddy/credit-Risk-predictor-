import { AssessmentRecord } from "../types";
import { predictCreditRisk } from "./randomForest";

export const INITIAL_APPLICANTS = [
  {
    id: "APP-9021",
    name: "Jonathan Vance",
    age: 42,
    income: 8500,
    dependents: 1,
    debtRatio: 0.28,
    openCreditLines: 10,
    realEstateLoans: 1,
    creditUtilization: 15.2,
    late3059: 0,
    late6089: 0,
    late90Plus: 0,
    date: "2026-07-06 14:32"
  },
  {
    id: "APP-9022",
    name: "Elena Rodriguez",
    age: 26,
    income: 3200,
    dependents: 2,
    debtRatio: 0.62,
    openCreditLines: 14,
    realEstateLoans: 0,
    creditUtilization: 85.1,
    late3059: 1,
    late6089: 0,
    late90Plus: 1,
    date: "2026-07-06 16:15"
  },
  {
    id: "APP-9023",
    name: "Marcus Thorne",
    age: 38,
    income: 5100,
    dependents: 0,
    debtRatio: 0.48,
    openCreditLines: 8,
    realEstateLoans: 1,
    creditUtilization: 52.4,
    late3059: 0,
    late6089: 1,
    late90Plus: 0,
    date: "2026-07-06 17:45"
  },
  {
    id: "APP-9024",
    name: "Sarah Jenkins",
    age: 52,
    income: 12500,
    dependents: 0,
    debtRatio: 0.15,
    openCreditLines: 12,
    realEstateLoans: 2,
    creditUtilization: 8.4,
    late3059: 0,
    late6089: 0,
    late90Plus: 0,
    date: "2026-07-07 09:10"
  },
  {
    id: "APP-9025",
    name: "Timothy Cho",
    age: 31,
    income: 4200,
    dependents: 3,
    debtRatio: 0.72,
    openCreditLines: 16,
    realEstateLoans: 0,
    creditUtilization: 95.0,
    late3059: 3,
    late6089: 1,
    late90Plus: 2,
    date: "2026-07-07 10:05"
  }
];

export function getInitialAssessments(): AssessmentRecord[] {
  return INITIAL_APPLICANTS.map(app => {
    const prediction = predictCreditRisk({
      age: app.age,
      income: app.income,
      dependents: app.dependents,
      debtRatio: app.debtRatio,
      openCreditLines: app.openCreditLines,
      realEstateLoans: app.realEstateLoans,
      creditUtilization: app.creditUtilization,
      late3059: app.late3059,
      late6089: app.late6089,
      late90Plus: app.late90Plus
    });

    return {
      id: app.id,
      applicant: {
        ...app
      },
      prediction,
      date: app.date
    };
  });
}
