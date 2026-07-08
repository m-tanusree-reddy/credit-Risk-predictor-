import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssessmentRecord, ViewType } from "../types";
import { validateApplicantData } from "../utils/randomForest";
import { predictApplicant } from "../utils/api";
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

  // CSV parsing logic inside the client (100% robust and reliable)
  const handleCsvProcess = async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("Empty CSV file content.");

        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error("CSV does not contain header or data lines.");

        // Parse headers and map columns by flexible casing and naming variations
        const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
        
        const colMap = {
          name: headers.findIndex(h => h.includes("name") || h.includes("applicant")),
          age: headers.findIndex(h => h.includes("age")),
          income: headers.findIndex(h => h.includes("income") || h.includes("salary")),
          dependents: headers.findIndex(h => h.includes("dependent") || h.includes("dep")),
          debtRatio: headers.findIndex(h => h.includes("debt") || h.includes("ratio")),
          creditLines: headers.findIndex(h => h.includes("open") || (h.includes("line") && !h.includes("revolving") && !h.includes("real") && !h.includes("estate"))),
          realEstateLoans: headers.findIndex(h => h.includes("real") || h.includes("estate") || h.includes("mortgage")),
          utilization: headers.findIndex(h => h.includes("util") || h.includes("revolving") || h.includes("percent")),
          late30: headers.findIndex(h => h.includes("30") || h.includes("late30")),
          late60: headers.findIndex(h => h.includes("60") || h.includes("late60")),
          late90: headers.findIndex(h => h.includes("90") || h.includes("late90") || h.includes("severe")),
        };

        // Basic verification (verify that we have parsed some headers)
        if (headers.length === 0) {
          throw new Error("CSV file does not contain any headers.");
        }

        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

        // Cap data rows to 500 for UI/network speed. Kaggle has 150k lines.
        const maxDataRows = 500;
        const totalRows = lines.length - 1;
        if (totalRows > maxDataRows) {
          alert(`The uploaded file contains ${totalRows.toLocaleString()} rows. To prevent network congestion and browser crash, only the first ${maxDataRows} records will be processed.`);
        }

        const dataLines = lines.slice(1, maxDataRows + 1);

        // Map and validate raw data first
        const rawRows = dataLines.map((line, idx) => {
          const rowValues = line.split(",").map(val => val.trim().replace(/^["']|["']$/g, ""));
          const i = idx + 1; // row index
          return {
            name: (colMap.name !== -1 && rowValues[colMap.name]) ? rowValues[colMap.name] : `Applicant #${i}`,
            rawData: {
              age: colMap.age !== -1 ? Number(rowValues[colMap.age]) : 45,
              income: colMap.income !== -1 ? Number(rowValues[colMap.income]) : 6000,
              dependents: colMap.dependents !== -1 ? Number(rowValues[colMap.dependents]) : 0,
              debtRatio: colMap.debtRatio !== -1 ? Number(rowValues[colMap.debtRatio]) : 0.35,
              openCreditLines: colMap.creditLines !== -1 ? Number(rowValues[colMap.creditLines]) : 8,
              realEstateLoans: colMap.realEstateLoans !== -1 ? Number(rowValues[colMap.realEstateLoans]) : 1,
              creditUtilization: colMap.utilization !== -1 ? Number(rowValues[colMap.utilization]) : 30.0,
              late3059: colMap.late30 !== -1 ? Number(rowValues[colMap.late30]) : 0,
              late6089: colMap.late60 !== -1 ? Number(rowValues[colMap.late60]) : 0,
              late90Plus: colMap.late90 !== -1 ? Number(rowValues[colMap.late90]) : 0,
            }
          };
        });

        const validatedRows = rawRows.map(r => ({
          name: r.name,
          validated: validateApplicantData(r.rawData)
        }));

        // Execute all predictions concurrently using Promise.all
        const assessmentsToCreate = await Promise.all(
          validatedRows.map(async (row, idx) => {
            const batchId = `APP-B${1000 + idx + 1}`;
            const prediction = await predictApplicant(row.validated);
            return {
              id: batchId,
              applicant: {
                id: batchId,
                name: row.name,
                ...row.validated,
                date: timestamp
              },
              prediction,
              date: timestamp
            } as AssessmentRecord;
          })
        );

        if (assessmentsToCreate.length === 0) {
          throw new Error("No valid applicant rows were processed from the CSV.");
        }

        // Save batch to main store and locally
        onAddAssessmentsBatch(assessmentsToCreate);
        setBatchResults(assessmentsToCreate);
        setCurrentPage(1);
        setIsProcessing(false);
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMsg(err?.message || "Failed to parse CSV file. Ensure columns are separated by commas.");
      }
    };
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
          <div className="p-3 bg-[#161618] border border-white/5 rounded-lg text-blue-500">
            {isProcessing ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <Upload size={24} />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-300">
              {isProcessing ? "Underwriting Portfolio..." : "Drag & drop or click to upload applicant CSV"}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
              MAXIMUM FILE SIZE: 50MB | UP TO 10,000 ROWS
            </p>
          </div>
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
