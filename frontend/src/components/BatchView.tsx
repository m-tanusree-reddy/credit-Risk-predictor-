import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssessmentRecord, ViewType } from "../types";
import { predictBatch } from "../utils/api";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  Loader2,
  ArrowRight
} from "lucide-react";

interface BatchViewProps {
  onAddAssessmentsBatch: (records: AssessmentRecord[]) => void;
  onSelectAssessment: (record: AssessmentRecord) => void;
  onNavigate: (view: ViewType) => void;
  batchResults: AssessmentRecord[];
  setBatchResults: (results: AssessmentRecord[]) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
}

export default function BatchView({ 
  onAddAssessmentsBatch, 
  onSelectAssessment, 
  onNavigate,
  batchResults,
  setBatchResults,
  fileName,
  setFileName
}: BatchViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [steps, setSteps] = useState<{
    id: number;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    details?: string;
  }[]>([]);
  
  // Download a beautiful, ready-to-use sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent = "Name,Age,MonthlyIncome,Dependents,DebtRatio,OpenCreditLines,RealEstateLoans,CreditUtilization,Late3059,Late6089,Late90Plus\n" +
      "John Miller,45,8200,1,0.24,10,1,18.5,0,0,0\n" +
      "Sarah Connor,29,3100,2,0.65,12,0,82.4,1,1,1\n" +
      "Richard Hendricks,32,5400,0,0.42,7,1,45.2,0,0,0\n" +
      "Evelyn Wood,58,11200,0,0.18,15,2,12.0,0,0,0\n" +
      "Marcus Vance,36,4200,3,0.52,9,0,61.0,2,0,0\n" +
      "Timothy Wu,27,2900,1,0.48,6,0,75.0,0,1,1\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "applicants_credit_risk_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV upload handler (single request, processed completely on the server)
  const handleCsvProcess = async (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("AI batch processing is restricted to CSV files only. Please upload a valid applicant spreadsheet.");
      setIsProcessing(false);
      setFileName(null);
      return;
    }
    setFileName(file.name);
    setIsProcessing(true);
    
    const initialSteps = [
      { id: 1, label: "Inspect & Parse CSV File", status: 'active' as const, details: "Reading spreadsheet content..." },
      { id: 2, label: "Submit to FastAPI Backend", status: 'pending' as const },
      { id: 3, label: "Execute Ensemble Model (200 Trees)", status: 'pending' as const },
      { id: 4, label: "Compute Tree SHAP Attributions", status: 'pending' as const },
    ];
    setSteps(initialSteps);

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg("Failed to read the local CSV file.");
      setIsProcessing(false);
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const, details: "Read error" } : s));
    };

    reader.onload = async (e) => {
      let timer1: any;
      let timer2: any;
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length <= 1) {
          throw new Error("The uploaded CSV file is empty or only contains headers.");
        }

        const header = lines[0];
        const rawRowCount = lines.length - 1;

        let fileToUpload = file;
        let details = `Detected ${rawRowCount} applicant records.`;

        if (rawRowCount > 500) {
          details += ` Capping to first 500 rows for system performance.`;
          const cappedLines = [header, ...lines.slice(1, 501)];
          const cappedCsv = cappedLines.join("\n");
          const blob = new Blob([cappedCsv], { type: "text/csv" });
          fileToUpload = new File([blob], file.name, { type: "text/csv" });
        }

        // Update Step 1 -> completed, Step 2 -> active
        setSteps(prev => prev.map(s => 
          s.id === 1 ? { ...s, status: 'completed' as const, details } : 
          s.id === 2 ? { ...s, status: 'active' as const, details: `Uploading ${Math.min(rawRowCount, 500)} rows...` } : 
          s
        ));

        // Start progressive timers for user visibility while fetch runs
        timer1 = setTimeout(() => {
          setSteps(prev => prev.map(s => 
            s.id === 2 ? { ...s, status: 'completed' as const } : 
            s.id === 3 ? { ...s, status: 'active' as const, details: "Running 200 random forest estimators..." } : 
            s
          ));
        }, 800);

        timer2 = setTimeout(() => {
          setSteps(prev => prev.map(s => 
            s.id === 3 ? { ...s, status: 'completed' as const } : 
            s.id === 4 ? { ...s, status: 'active' as const, details: "Computing local feature SHAP values..." } : 
            s
          ));
        }, 1800);

        // Actual API Call
        const results = await predictBatch(fileToUpload);

        clearTimeout(timer1);
        clearTimeout(timer2);

        // Mark all steps as complete
        setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
        await new Promise(resolve => setTimeout(resolve, 400));

        if (results.length === 0) {
          throw new Error("No valid applicant records were returned from the batch processing server.");
        }

        onAddAssessmentsBatch(results);
        setBatchResults(results);
        setCurrentPage(1);
        setIsProcessing(false);
      } catch (err: any) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setIsProcessing(false);
        setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const, details: err?.message || "Failed" } : s));
        setErrorMsg(err?.message || "Unable to process batch assessment. Please try again.");
      }
    };

    reader.readAsText(file);
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
      handleCsvProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCsvProcess(e.target.files[0]);
    }
  };

  // Export results as CSV file (fully functional)
  const handleExportCsvResults = () => {
    if (batchResults.length === 0) return;

    let csvContent = "Applicant ID,Applicant Name,Default Probability (%),Risk Level\n";
    batchResults.forEach(record => {
      csvContent += `${record.id},"${record.applicant.name}",${record.prediction.score}%,${record.prediction.riskLevel} RISK\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scored_${fileName || "batch_results"}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination calculations
  const totalPages = Math.ceil(batchResults.length / itemsPerPage) || 1;
  const paginated = batchResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRiskBadgeStyles = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'HIGH': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'CRITICAL': return 'bg-red-500/15 text-red-400 border border-red-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6" id="batch-view-container">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Batch CSV Processing</h1>
        <p className="text-sm text-slate-400 mt-1">
          Scoring high-volume credit portfolios with automated decision trees in seconds.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-[#161618] border border-white/5 rounded-2xl p-5" id="batch-upload-box">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-blue-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Upload Applicant Database</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Provide a comma-separated database file matching standard underwriting features. 
          The engine will evaluate every record through the saved FastAPI credit risk model and generate local explanation metrics.
        </p>

        <div
          id="batch-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
            isDragging 
              ? "border-blue-500 bg-blue-500/5 text-blue-400" 
              : "border-white/10 hover:border-white/20 bg-[#1C1C1F]/60 text-slate-400"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv"
            className="hidden"
          />
          {isProcessing ? (
            <div className="w-full max-w-sm py-4 text-left space-y-3.5 bg-[#1C1C1F]/60 border border-white/5 p-5 rounded-2xl">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold mb-2">
                Batch Underwriting Progress
              </p>
              <div className="space-y-3">
                {steps.map((step) => {
                  const isActive = step.status === 'active';
                  const isCompleted = step.status === 'completed';
                  const isError = step.status === 'error';
                  
                  return (
                    <div key={step.id} className="flex items-start gap-3 text-xs">
                      <div className="mt-0.5">
                        {isCompleted && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                        {isActive && <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />}
                        {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />}
                        {isError && <AlertCircle size={14} className="text-red-400 shrink-0" />}
                      </div>
                      <div className="space-y-0.5">
                        <p className={`font-medium ${isActive ? "text-slate-100 font-semibold" : isCompleted ? "text-slate-300" : isError ? "text-red-400 font-semibold" : "text-slate-500"}`}>
                          {step.label}
                        </p>
                        {step.details && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 bg-[#161618] border border-white/5 rounded-lg text-blue-500">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Drag & drop or click to upload applicant CSV
                </p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                  MAXIMUM FILE SIZE: 50MB | UP TO 500 ROWS
                </p>
              </div>
            </>
          )}
          {fileName && (
            <div className="px-3 py-1 bg-[#161618] rounded border border-white/5 flex items-center gap-2 text-xs font-mono text-slate-400">
              <FileSpreadsheet size={12} className="text-emerald-400" />
              <span>{fileName}</span>
            </div>
          )}
        </div>

        {/* Sample Download Button */}
        <div className="flex justify-center mt-3">
          <button
            id="btn-download-sample-csv"
            type="button"
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 font-medium font-mono transition-colors"
          >
            <Download size={13} />
            Download Sample CSV
          </button>
        </div>

        {/* Error notification if parsing fails */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-xs text-red-400" id="batch-error-alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Batch Import Error</p>
              <p className="mt-0.5 text-slate-400">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Batch Processing Results table */}
      {batchResults.length > 0 && (
        <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4" id="batch-results-panel">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Batch Processing Results</h2>
              <p className="text-xs text-slate-400 mt-1">Showing compiled scores from &apos;{fileName}&apos;</p>
            </div>
            <button
              id="btn-download-results-csv"
              type="button"
              onClick={handleExportCsvResults}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition shadow-lg shadow-blue-900/10"
            >
              <Download size={14} />
              Download CSV Results
            </button>
          </div>

          <div className="overflow-x-auto" id="batch-results-table-wrapper">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Applicant ID</th>
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Default Prob.</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.map((record) => (
                  <tr 
                    key={record.id} 
                    className="hover:bg-white/5 transition-colors group"
                    id={`batch-row-${record.id}`}
                  >
                    <td className="py-3 px-4 font-mono text-slate-500">
                      #{record.id}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-medium">
                      {record.applicant.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-100 font-semibold">
                      {record.prediction.score}%
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${getRiskBadgeStyles(record.prediction.riskLevel)}`}>
                        {record.prediction.riskLevel} RISK
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        id={`btn-batch-explain-${record.id}`}
                        onClick={() => onSelectAssessment(record)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 font-mono transition-colors"
                      >
                        <Eye size={12} />
                        Explain SHAP
                        <ArrowRight size={10} className="transform group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-500 font-mono">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, batchResults.length)} of {batchResults.length} entries
            </span>
            <div className="flex gap-1">
              <button
                id="btn-batch-prev"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-[#1C1C1F] border border-white/5 rounded disabled:opacity-40 disabled:hover:bg-[#1C1C1F] hover:bg-white/5 transition"
              >
                &lt;
              </button>
              {(() => {
                const range: (number | string)[] = [];
                const delta = 2;
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                    range.push(i);
                  } else if (range[range.length - 1] !== "...") {
                    range.push("...");
                  }
                }
                return range.map((page, idx) => {
                  if (page === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-600 select-none">
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      id={`btn-batch-page-${page}`}
                      key={`page-${page}`}
                      onClick={() => setCurrentPage(page as number)}
                      className={`px-2.5 py-1 rounded border transition cursor-pointer ${
                        currentPage === page 
                          ? "bg-blue-600 border-blue-600 text-white" 
                          : "bg-[#1C1C1F] border-white/5 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      {page}
                    </button>
                  );
                });
              })()}
              <button
                id="btn-batch-next"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-[#1C1C1F] border border-white/5 rounded disabled:opacity-40 disabled:hover:bg-[#1C1C1F] hover:bg-white/5 transition"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
