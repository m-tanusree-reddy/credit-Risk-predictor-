import { ApplicantData, PredictionResult } from "./utils/randomForest";

export interface Applicant extends ApplicantData {
  id: string;
  name: string;
  date: string;
}

export interface AssessmentRecord {
  id: string;
  applicant: Applicant;
  prediction: PredictionResult;
  date: string;
}

export type ViewType = 'dashboard' | 'assessment' | 'batch' | 'explainability';
