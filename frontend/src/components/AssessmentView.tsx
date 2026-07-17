import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Applicant, AssessmentRecord } from "../types";
import { predictCreditRisk, validateApplicantData, ApplicantData } from "../utils/randomForest";
import { predictApplicant } from "../utils/api";
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  FileCode,
  Info
} from "lucide-react";

interface AssessmentViewProps {
  onAddAssessment: (record: AssessmentRecord) => void;
  onNavigateToExplainability: (record: AssessmentRecord) => void;
}

const LOADING_STEPS = [
  "Initializing multi-modal extraction...",
  "Applying Gemini OCR on document layout...",
  "Extracting applicant identity and name...",
  "Identifying credit lines and utilization ratios...",
  "Estimating monthly debt-to-income metrics...",
  "Finalizing structured variable validation..."
];

export default function AssessmentView({ 
  onAddAssessment, 
  onNavigateToExplainability 
}: AssessmentViewProps) {
  // Form State
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">(45);
  const [income, setIncome] = useState<number | "">(6000);
  const [dependents, setDependents] = useState<number | "">(0);
  const [debtRatio, setDebtRatio] = useState<number | "">(0.35);
  const [openCreditLines, setOpenCreditLines] = useState<number | "">(8);
  const [realEstateLoans, setRealEstateLoans] = useState<number | "">(1);
  const [creditUtilization, setCreditUtilization] = useState<number | "">(30.0);
  const [late3059, setLate3059] = useState<number | "">(0);
  const [late6089, setLate6089] = useState<number | "">(0);
  const [late90Plus, setLate90Plus] = useState<number | "">(0);

  // New Loan Details Section State
  const [loanAmount, setLoanAmount] = useState<number | "">("");
  const [loanPurpose, setLoanPurpose] = useState("Debt Consolidation");
  const [loanDuration, setLoanDuration] = useState<number | "">(36);
  const [predictionNotes, setPredictionNotes] = useState("");

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Document state
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [extractionMsg, setExtractionMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prediction State
  const [predictionResult, setPredictionResult] = useState<ReturnType<typeof predictCreditRisk> | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLoadingSteps = () => {
    setLoadingStep(0);
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    
    loadingIntervalRef.current = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
    }, 1500);
  };

  const stopLoadingSteps = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  // Form validator
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Applicant Name is required.";
    
    if (age === "" || isNaN(Number(age))) {
      errs.age = "Age is required.";
    } else if (Number(age) < 18 || Number(age) > 100) {
      errs.age = "Age must be between 18 and 100.";
    }

    if (income === "" || isNaN(Number(income))) {
      errs.income = "Monthly Income is required.";
    } else if (Number(income) < 0) {
      errs.income = "Monthly Income cannot be negative.";
    }

    if (debtRatio === "" || isNaN(Number(debtRatio))) {
      errs.debtRatio = "Debt Ratio is required.";
    } else if (Number(debtRatio) < 0) {
      errs.debtRatio = "Debt Ratio cannot be negative.";
    }

    if (creditUtilization === "" || isNaN(Number(creditUtilization))) {
      errs.creditUtilization = "Credit Utilization is required.";
    } else if (Number(creditUtilization) < 0 || Number(creditUtilization) > 100) {
      errs.creditUtilization = "Credit Utilization must be between 0% and 100%.";
    }

    if (openCreditLines === "" || isNaN(Number(openCreditLines))) {
      errs.openCreditLines = "Open Credit Lines is required.";
    } else if (Number(openCreditLines) < 0) {
      errs.openCreditLines = "Open Credit Lines cannot be negative.";
    }

    if (late3059 === "" || isNaN(Number(late3059)) || Number(late3059) < 0) {
      errs.late3059 = "Delinquency count cannot be negative.";
    }

    if (late6089 === "" || isNaN(Number(late6089)) || Number(late6089) < 0) {
      errs.late6089 = "Delinquency count cannot be negative.";
    }

    if (late90Plus === "" || isNaN(Number(late90Plus)) || Number(late90Plus) < 0) {
      errs.late90Plus = "Delinquency count cannot be negative.";
    }

    if (loanAmount === "" || isNaN(Number(loanAmount))) {
      errs.loanAmount = "Loan Amount Requested is required.";
    } else if (Number(loanAmount) < 0) {
      errs.loanAmount = "Loan Amount Requested cannot be negative.";
    }

    if (dependents !== "" && Number(dependents) < 0) {
      errs.dependents = "Dependents count cannot be negative.";
    }

    if (realEstateLoans !== "" && Number(realEstateLoans) < 0) {
      errs.realEstateLoans = "Real Estate Loans count cannot be negative.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Process manual form prediction
  const handlePredict = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;
    
    const validated = validateApplicantData({
      age: Number(age),
      income: Number(income),
      dependents: dependents === "" ? 0 : Number(dependents),
      debtRatio: Number(debtRatio),
      openCreditLines: Number(openCreditLines),
      realEstateLoans: realEstateLoans === "" ? 0 : Number(realEstateLoans),
      creditUtilization: Number(creditUtilization),
      late3059: late3059 === "" ? 0 : Number(late3059),
      late6089: late6089 === "" ? 0 : Number(late6089),
      late90Plus: late90Plus === "" ? 0 : Number(late90Plus)
    });

    setIsPredicting(true);
    setPredictionError(null);

    try {
      const result = await predictApplicant(validated);
      setPredictionResult(result);
    } catch (err: any) {
      setPredictionError(err?.message || "Unable to reach the credit risk API.");
    } finally {
      setIsPredicting(false);
    }
  };

  // Read file and trigger OCR endpoint
  const handleFileProcess = async (file: File) => {
    setFileName(file.name);
    setIsLoading(true);
    setExtractionMsg(null);
    startLoadingSteps();

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        
        try {
          const response = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileBase64: base64String,
              mimeType: file.type,
              fileName: file.name
            })
          });

          const resData = await response.json();
          stopLoadingSteps();
          setIsLoading(false);

          if (resData.success && resData.data) {
            const data = resData.data;
            // Populate form fields
            setName(data.name || "");
            setAge(data.age || 45);
            setIncome(data.income || 6000);
            setDependents(data.dependents !== undefined ? data.dependents : 0);
            setDebtRatio(data.debtRatio || 0.35);
            setOpenCreditLines(data.openCreditLines || 8);
            setRealEstateLoans(data.realEstateLoans !== undefined ? data.realEstateLoans : 1);
            setCreditUtilization(data.creditUtilization || 30.0);
            setLate3059(data.late3059 !== undefined ? data.late3059 : 0);
            setLate6089(data.late6089 !== undefined ? data.late6089 : 0);
            setLate90Plus(data.late90Plus !== undefined ? data.late90Plus : 0);

            setExtractionMsg({
              type: 'success',
              text: `Successfully parsed ${data.documentType || "document"}! Autocompleted fields below. Review and edit values before predicting risk.`
            });
            // Clear any previous prediction results or errors so user must predict manually
            setPredictionResult(null);
            setPredictionError(null);
          } else {
            setExtractionMsg({
              type: 'error',
              text: resData.error || "AI document extraction is currently unavailable. You can continue by entering applicant information manually."
            });
          }
        } catch (err: any) {
          stopLoadingSteps();
          setIsLoading(false);
          setExtractionMsg({
            type: 'error',
            text: "AI document extraction is currently unavailable. You can continue by entering applicant information manually."
          });
        }
      };
    } catch (err) {
      stopLoadingSteps();
      setIsLoading(false);
      setExtractionMsg({
        type: 'error',
        text: "AI document extraction is currently unavailable. You can continue by entering applicant information manually."
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Save the record to the history logs
  const handleSaveAssessment = () => {
    if (!name.trim()) {
      alert("Please provide an Applicant Name to save the assessment.");
      return;
    }
    if (!validateForm()) {
      alert("Please correct validation errors before logging the assessment.");
      return;
    }

    const currentData: ApplicantData = validateApplicantData({
      age: Number(age),
      income: Number(income),
      dependents: dependents === "" ? 0 : Number(dependents),
      debtRatio: Number(debtRatio),
      openCreditLines: Number(openCreditLines),
      realEstateLoans: realEstateLoans === "" ? 0 : Number(realEstateLoans),
      creditUtilization: Number(creditUtilization),
      late3059: late3059 === "" ? 0 : Number(late3059),
      late6089: late6089 === "" ? 0 : Number(late6089),
      late90Plus: late90Plus === "" ? 0 : Number(late90Plus)
    });

    const activePrediction = predictionResult || predictCreditRisk(currentData);
    
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const appId = `APP-${randomSuffix}`;
    const newRecord: AssessmentRecord = {
      id: appId,
      applicant: {
        id: appId,
        name: name,
        ...currentData,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16)
      },
      prediction: activePrediction,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      loanAmount: loanAmount === "" ? undefined : Number(loanAmount),
      loanPurpose: loanPurpose || undefined,
      loanDuration: loanDuration === "" ? undefined : Number(loanDuration),
      notes: predictionNotes || undefined
    };

    onAddAssessment(newRecord);
    onNavigateToExplainability(newRecord);
  };

  // Format driver text for UI
  const formatFeatureLabel = (key: string) => {
    switch (key) {
      case 'creditUtilization': return 'Credit Utilization';
      case 'debtRatio': return 'Debt Ratio';
      case 'income': return 'Monthly Income';
      case 'age': return 'Age';
      case 'late90Plus': return 'Severe Past Due (90d+)';
      case 'late3059': return 'Minor Past Due (30-59d)';
      case 'late6089': return 'Moderate Past Due (60-89d)';
      case 'openCreditLines': return 'Open Accounts';
      case 'realEstateLoans': return 'Real Estate Loans';
      case 'dependents': return 'Dependents Count';
      default: return key;
    }
  };

  // Feature value retriever for driver explanations
  const getFeatureValue = (feature: string): number => {
    switch (feature) {
      case 'age': return Number(age) || 0;
      case 'income': return Number(income) || 0;
      case 'dependents': return Number(dependents) || 0;
      case 'debtRatio': return Number(debtRatio) || 0;
      case 'openCreditLines': return Number(openCreditLines) || 0;
      case 'realEstateLoans': return Number(realEstateLoans) || 0;
      case 'creditUtilization': return Number(creditUtilization) || 0;
      case 'late3059': return Number(late3059) || 0;
      case 'late6089': return Number(late6089) || 0;
      case 'late90Plus': return Number(late90Plus) || 0;
      default: return 0;
    }
  };

  // Underwriter friendly explanations of features based on value and contribution
  const getDriverExplanation = (feature: string, val: number, shapVal: number) => {
    const isIncrease = shapVal > 0;
    switch (feature) {
      case 'creditUtilization':
        return isIncrease 
          ? `High utilization (${val}%) exceeds recommended threshold, elevating risk.`
          : `Disciplined utilization (${val}%) demonstrates low credit risk exposure.`;
      case 'debtRatio':
        return isIncrease
          ? `Elevated debt-to-income ratio (${val.toFixed(2)}) indicates heavy debt service burden.`
          : `Conservative debt-to-income ratio (${val.toFixed(2)}) leaves comfortable capital cushion.`;
      case 'income':
        return isIncrease
          ? `Low monthly income ($${val.toLocaleString()}) limits emergency cash buffer.`
          : `Strong monthly income ($${val.toLocaleString()}) provides healthy debt repayment capacity.`;
      case 'age':
        return isIncrease
          ? `Younger age demographic (${val} years) indicates shorter credit history trail.`
          : `Mature age profile (${val} years) correlates with established repayment stability.`;
      case 'late3059':
        return `Occurrences of 30-59 days past due (${val}) signal initial delinquency behavior.`;
      case 'late6089':
        return `Occurrences of 60-89 days past due (${val}) show moderate payment delinquency history.`;
      case 'late90Plus':
        return `Occurrences of 90+ days past due (${val}) represent severe delinquency risk history.`;
      case 'openCreditLines':
        return isIncrease
          ? `Elevated open accounts (${val}) indicate high potential credit drawdown capacity.`
          : `Optimally sized credit footprint (${val} open accounts) supports file thickness.`;
      case 'realEstateLoans':
        return isIncrease
          ? `Additional housing leverage (${val} loans) adds to fixed household obligations.`
          : `Minimal housing loan exposure (${val}) reduces fixed expenditure stress.`;
      case 'dependents':
        return isIncrease
          ? `Dependents count (${val}) increases non-discretionary household budget obligations.`
          : `Zero or minimal dependents reduces fixed household expense load.`;
      default:
        return `${feature}: ${val} (${isIncrease ? 'adds' : 'reduces'} probability of default by ${Math.abs(shapVal).toFixed(1)}%)`;
    }
  };

  // Generate top risk drivers
  const getRiskDrivers = () => {
    if (!predictionResult || !predictionResult.shapValues) return [];
    
    // Convert to array and sort by absolute contribution
    return Object.entries(predictionResult.shapValues)
      .map(([feature, val]) => ({ feature, value: Number(val) }))
      .filter(item => item.value !== 0)
      .sort((a, b) => b.value - a.value); // Positive (risk drivers) first, then negative
  };

  const getRiskLevelStyles = (level: string) => {
    switch (level) {
      case 'LOW':
        return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'LOW RISK' };
      case 'MEDIUM':
        return { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'MEDIUM RISK' };
      case 'HIGH':
        return { text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'HIGH RISK' };
      case 'CRITICAL':
        return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', label: 'CRITICAL RISK' };
      default:
        return { text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'UNKNOWN' };
    }
  };

  const currentLevel = predictionResult ? getRiskLevelStyles(predictionResult.riskLevel) : null;

  // Render SVG semi-circle gauge
  const renderGauge = (score: number) => {
    const radius = 65;
    const circumference = Math.PI * radius; // for semicircle
    const strokeDashoffset = circumference - (score / 100) * circumference;

    // Color gradient based on score
    let strokeColor = "#10b981"; // emerald
    if (score >= 15 && score < 45) strokeColor = "#f59e0b"; // amber
    if (score >= 45 && score < 75) strokeColor = "#f43f5e"; // rose
    if (score >= 75) strokeColor = "#ef4444"; // red

    return (
      <div className="relative flex justify-center items-center h-32 w-full mt-4" id="svg-gauge-wrapper">
        <svg viewBox="0 0 160 100" className="w-52 h-32">
          {/* Background track */}
          <path
            d="M 15 90 A 65 65 0 0 1 145 90"
            fill="none"
            stroke="#1e293b"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled value path */}
          <path
            d="M 15 90 A 65 65 0 0 1 145 90"
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute text-center bottom-2 flex flex-col justify-center items-center">
          <span className="text-3xl font-mono font-bold text-slate-100">{score}%</span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 mt-0.5">DEFAULT PROBABILITY</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="assessment-view-container">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Applicant Credit Assessment</h1>
        <p className="text-sm text-slate-400 mt-1">
          Perform high-precision scoring by uploading financial documentation or entering parameters manually.
        </p>
      </div>

      {/* PDF/Image OCR Extraction Area */}
      <div className="bg-[#161618] border border-white/5 rounded-2xl p-5" id="document-extractor-zone">
        <div className="flex items-center gap-2 mb-3">
          <FileCode size={18} className="text-blue-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">AI Document Assistant</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Upload a salary slip, bank statement, loan application or credit report. AI will extract any available applicant information and automatically pre-fill the assessment form. Review and edit extracted values before running the prediction.
        </p>

        <div
          id="dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
            isDragging 
              ? "border-blue-500 bg-blue-500/5 text-blue-400" 
              : "border-white/10 hover:border-white/20 bg-[#1C1C1F]/60 text-slate-400"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,image/jpg"
            className="hidden"
          />
          <div className="p-3 bg-[#161618] border border-white/5 rounded-lg text-blue-500">
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <Upload size={24} />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-300">
              {isLoading ? "Analyzing Document..." : "Drag & drop or click to upload applicant document"}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
              SUPPORTED FORMATS: PDF, PNG, JPG, JPEG | MAX SIZE: 20MB
            </p>
          </div>
          {fileName && (
            <div className="px-3 py-1 bg-[#161618] rounded border border-white/5 flex items-center gap-2 text-xs font-mono text-slate-400">
              <FileText size={12} className="text-blue-400" />
              <span>{fileName}</span>
            </div>
          )}
        </div>

        {/* Loading / OCR Overlay Steps */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-3 bg-[#1C1C1F] border border-white/10 rounded-lg flex items-center gap-3"
            >
              <Loader2 className="animate-spin text-blue-500 shrink-0" size={16} />
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-200">Underwriting Agent: </span>
                <span className="font-mono">{LOADING_STEPS[loadingStep]}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status notification toast */}
        {extractionMsg && (
          <div className={`mt-4 p-3 border rounded-lg flex items-start gap-3 text-xs ${
            extractionMsg.type === 'success' 
              ? "bg-green-500/10 border-green-500/20 text-green-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {extractionMsg.type === 'success' ? (
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{extractionMsg.type === 'success' ? 'OCR Analysis Complete' : 'Extraction Failure'}</p>
              <p className="mt-0.5 text-slate-400">{extractionMsg.text}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Form + Predict Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="assessment-workspace">
        {/* Left column: Editable fields */}
        <div className="lg:col-span-7 space-y-6">
          <form 
            id="manual-assessment-form"
            onSubmit={handlePredict} 
            className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Personal &amp; Financial Profile</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Applicant Name *
                </label>
                <input
                  id="applicant-name"
                  type="text"
                  placeholder="Applicant Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition ${
                    errors.name ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  required
                />
                {errors.name && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Age *
                </label>
                <input
                  id="applicant-age"
                  type="number"
                  placeholder="e.g. 45"
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.age ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="18"
                  max="120"
                  required
                />
                {errors.age && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Monthly Income ($) *
                </label>
                <input
                  id="applicant-income"
                  type="number"
                  placeholder="e.g. 6000"
                  value={income}
                  onChange={(e) => setIncome(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.income ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                  required
                />
                {errors.income && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.income}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Number of Dependents
                </label>
                <input
                  id="applicant-dependents"
                  type="number"
                  placeholder="0"
                  value={dependents}
                  onChange={(e) => setDependents(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.dependents ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                />
                {errors.dependents && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.dependents}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-between">
                  <span>Debt Ratio *</span>
                  <span className="text-[9px] text-slate-500 lowercase font-normal">debts / income</span>
                </label>
                <input
                  id="applicant-debt-ratio"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0.35"
                  value={debtRatio}
                  onChange={(e) => setDebtRatio(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.debtRatio ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                  required
                />
                {errors.debtRatio && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.debtRatio}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Credit Utilization (%) *
                </label>
                <input
                  id="applicant-utilization"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 30.0"
                  value={creditUtilization}
                  onChange={(e) => setCreditUtilization(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.creditUtilization ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                  max="100"
                  required
                />
                {errors.creditUtilization && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.creditUtilization}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Open Credit Lines *
                </label>
                <input
                  id="applicant-credit-lines"
                  type="number"
                  placeholder="e.g. 8"
                  value={openCreditLines}
                  onChange={(e) => setOpenCreditLines(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.openCreditLines ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                  required
                />
                {errors.openCreditLines && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.openCreditLines}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Real Estate Loans
                </label>
                <input
                  id="applicant-real-estate-loans"
                  type="number"
                  placeholder="e.g. 1"
                  value={realEstateLoans}
                  onChange={(e) => setRealEstateLoans(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.realEstateLoans ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                />
                {errors.realEstateLoans && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.realEstateLoans}</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500">Delinquency History (Past 2 Years)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 text-center font-mono uppercase">30-59 Days Late *</label>
                  <input
                    id="applicant-late-30"
                    type="number"
                    value={late3059}
                    onChange={(e) => setLate3059(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 text-center focus:outline-none focus:border-blue-500 transition font-mono ${
                      errors.late3059 ? 'border-red-500/50' : 'border-white/10'
                    }`}
                    min="0"
                    required
                  />
                  {errors.late3059 && <p className="text-red-400 text-[9px] mt-1 text-center font-mono">{errors.late3059}</p>}
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 text-center font-mono uppercase">60-89 Days Late *</label>
                  <input
                    id="applicant-late-60"
                    type="number"
                    value={late6089}
                    onChange={(e) => setLate6089(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 text-center focus:outline-none focus:border-blue-500 transition font-mono ${
                      errors.late6089 ? 'border-red-500/50' : 'border-white/10'
                    }`}
                    min="0"
                    required
                  />
                  {errors.late6089 && <p className="text-red-400 text-[9px] mt-1 text-center font-mono">{errors.late6089}</p>}
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 mb-1 text-center font-mono uppercase">90+ Days Late *</label>
                  <input
                    id="applicant-late-90"
                    type="number"
                    value={late90Plus}
                    onChange={(e) => setLate90Plus(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 text-center focus:outline-none focus:border-blue-500 transition font-mono ${
                      errors.late90Plus ? 'border-red-500/50' : 'border-white/10'
                    }`}
                    min="0"
                    required
                  />
                  {errors.late90Plus && <p className="text-red-400 text-[9px] mt-1 text-center font-mono">{errors.late90Plus}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                id="btn-trigger-predict"
                type="submit"
                disabled={isPredicting}
                className="flex-1 bg-[#1C1C1F] hover:bg-white/5 disabled:opacity-50 text-slate-300 border border-white/10 font-semibold py-2 px-4 rounded-lg text-xs transition"
              >
                {isPredicting ? "Predicting..." : "Predict Risk"}
              </button>
              <button
                id="btn-save-assessment"
                type="button"
                onClick={handleSaveAssessment}
                disabled={!name}
                className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-lg shadow-blue-900/10"
              >
                <Save size={14} />
                Save &amp; Log Assessment
              </button>
            </div>

            {predictionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-xs text-red-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Prediction API Error</p>
                  <p className="mt-0.5 text-slate-400">{predictionError}</p>
                </div>
              </div>
            )}
          </form>

          {/* Separate Loan Details Section */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4" id="loan-details-section">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Loan Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Loan Amount Requested *
                </label>
                <input
                  id="loan-amount"
                  type="number"
                  placeholder="e.g. 25000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full bg-[#1C1C1F] border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono ${
                    errors.loanAmount ? 'border-red-500/50' : 'border-white/10'
                  }`}
                  min="0"
                  required
                />
                {errors.loanAmount && <p className="text-red-400 text-[10px] mt-1 font-mono">{errors.loanAmount}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Loan Purpose
                </label>
                <select
                  id="loan-purpose"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="w-full bg-[#1C1C1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono"
                >
                  <option value="Debt Consolidation">Debt Consolidation</option>
                  <option value="Home Improvement">Home Improvement</option>
                  <option value="Business Loan">Business Loan</option>
                  <option value="Education">Education</option>
                  <option value="Auto Loan">Auto Loan</option>
                  <option value="Major Purchase">Major Purchase</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Loan Duration (months)
                </label>
                <input
                  id="loan-duration"
                  type="number"
                  placeholder="e.g. 36"
                  value={loanDuration}
                  onChange={(e) => setLoanDuration(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-[#1C1C1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition font-mono"
                  min="1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Prediction Result Display */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex-1 flex flex-col justify-between space-y-4" id="assessment-result-card">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Assessment Result</h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">Predictions derived from multi-decision tree logic.</p>
            </div>

            {predictionResult ? (
              <div className="space-y-4 animate-fadeIn" id="prediction-result-view">
                {/* Gauge Chart */}
                {renderGauge(predictionResult.score)}

                {/* Risk Badge and Explanation */}
                {currentLevel && (
                  <div className={`p-4 border rounded-lg ${currentLevel.bg} space-y-1`}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${predictionResult.riskLevel === 'LOW' ? 'bg-green-500' : predictionResult.riskLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <span className={`font-mono font-bold text-xs ${currentLevel.text}`}>{currentLevel.label} TIER</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pt-1" id="prediction-narrative">
                      {predictionResult.riskLevel === 'LOW' && "This applicant demonstrates stable repayment behaviour with relatively low default probability."}
                      {predictionResult.riskLevel === 'MEDIUM' && "This applicant falls within moderate risk thresholds. Minor delinquency tracks or elevated credit utilization indicate attention is warranted, but overall cashflow remains supportive."}
                      {predictionResult.riskLevel === 'HIGH' && "This applicant displays elevated credit risk. Significant historical delinquencies, highly leveraged credit utilization or unstable debt margins are critical drivers."}
                      {predictionResult.riskLevel === 'CRITICAL' && "This applicant exhibits severe credit distress. Persistent 60-90+ days past due histories and critical credit utilization levels represent extreme probability of default."}
                    </p>
                  </div>
                )}

                {/* Top Risk Drivers list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">Top Risk Drivers</h3>
                  
                  {/* Increased Risk List */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-red-400 flex items-center gap-1">
                      <ArrowUpRight size={12} />
                      <span>↑ INCREASED RISK</span>
                    </div>
                    <div className="space-y-1">
                      {getRiskDrivers().filter(d => d.value > 0).slice(0, 3).map((driver) => {
                        const featureVal = getFeatureValue(driver.feature);
                        return (
                          <div key={driver.feature} className="p-2 bg-red-950/15 border border-red-500/10 rounded text-[11px] text-slate-300">
                            <span className="font-semibold text-slate-200 block mb-0.5">{formatFeatureLabel(driver.feature)}</span>
                            <span className="text-slate-400 leading-normal">
                              {getDriverExplanation(driver.feature, featureVal, driver.value)}
                            </span>
                          </div>
                        );
                      })}
                      {getRiskDrivers().filter(d => d.value > 0).length === 0 && (
                        <p className="text-[11px] text-slate-500 italic pl-1">No significant risk increasing factors identified.</p>
                      )}
                    </div>
                  </div>

                  {/* Reduced Risk List */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-green-400 flex items-center gap-1">
                      <ArrowDownRight size={12} />
                      <span>↓ REDUCED RISK</span>
                    </div>
                    <div className="space-y-1">
                      {getRiskDrivers().filter(d => d.value < 0).slice(0, 3).map((driver) => {
                        const featureVal = getFeatureValue(driver.feature);
                        return (
                          <div key={driver.feature} className="p-2 bg-green-950/15 border border-green-500/10 rounded text-[11px] text-slate-300">
                            <span className="font-semibold text-slate-200 block mb-0.5">{formatFeatureLabel(driver.feature)}</span>
                            <span className="text-slate-400 leading-normal">
                              {getDriverExplanation(driver.feature, featureVal, driver.value)}
                            </span>
                          </div>
                        );
                      })}
                      {getRiskDrivers().filter(d => d.value < 0).length === 0 && (
                        <p className="text-[11px] text-slate-500 italic pl-1">No significant risk reducing factors identified.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Prediction Notes */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Prediction Notes</label>
                  <textarea
                    value={predictionNotes}
                    onChange={(e) => setPredictionNotes(e.target.value)}
                    placeholder="Enter manual override reasons or qualitative remarks..."
                    className="w-full bg-[#1C1C1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition min-h-[60px]"
                  />
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-500">
                <HelpCircle size={32} className="text-slate-700 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-slate-400">Awaiting Variables</p>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-xs mx-auto">
                    Complete the profile details or drag document slip above to trigger underwriting prediction metrics.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Model Information footer Card */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-4 text-[10px] text-slate-500 grid grid-cols-2 gap-y-3 gap-x-2 font-mono">
            <div>
              <p className="uppercase text-slate-400">Model</p>
              <p className="text-slate-300 font-semibold mt-0.5">Random Forest</p>
            </div>
            <div>
              <p className="uppercase text-slate-400">ROC-AUC</p>
              <p className="text-slate-300 font-semibold mt-0.5">0.864</p>
            </div>
            <div>
              <p className="uppercase text-slate-400">Dataset</p>
              <p className="text-slate-300 font-semibold mt-0.5">Give Me Some Credit</p>
            </div>
            <div>
              <p className="uppercase text-slate-400">Backend</p>
              <p className="text-slate-300 font-semibold mt-0.5">FastAPI</p>
            </div>
            <div className="col-span-2">
              <p className="uppercase text-slate-400">Model Version</p>
              <p className="text-slate-300 font-semibold mt-0.5">v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
