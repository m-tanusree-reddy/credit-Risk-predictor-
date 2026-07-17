import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  UserCheck, 
  FileSpreadsheet, 
  Cpu
} from "lucide-react";

import { AssessmentRecord, ViewType } from "./types";
import { predictApplicant } from "./utils/api";
import { getInitialAssessments } from "./utils/sampleData";
import DashboardView from "./components/DashboardView";
import AssessmentView from "./components/AssessmentView";
import BatchView from "./components/BatchView";
import ExplainabilityView from "./components/ExplainabilityView";

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AssessmentRecord | null>(null);

  // Lifted Batch Processing State (keeps data alive when switching tabs)
  const [batchResults, setBatchResults] = useState<AssessmentRecord[]>([]);
  const [batchFileName, setBatchFileName] = useState<string | null>(null);

  // Sync assessments with LocalStorage
  useEffect(() => {
    const cached = localStorage.getItem("credit_assessments_records");
    if (cached) {
      try {
        setAssessments(JSON.parse(cached));
      } catch (err) {
        setAssessments([]);
      }
    } else {
      setAssessments([]);
      localStorage.setItem("credit_assessments_records", JSON.stringify([]));
    }
  }, []);

  const saveAssessments = (updated: AssessmentRecord[]) => {
    setAssessments(updated);
    localStorage.setItem("credit_assessments_records", JSON.stringify(updated));
  };

  // Handler to add a single assessment
  const handleAddAssessment = (record: AssessmentRecord) => {
    const updated = [record, ...assessments];
    saveAssessments(updated);
  };

  // Handler to add multiple assessments (batch)
  const handleAddAssessmentsBatch = (records: AssessmentRecord[]) => {
    const updated = [...records, ...assessments];
    saveAssessments(updated);
  };

  const handleClearHistory = () => {
    saveAssessments([]);
    setSelectedRecord(null);
  };

  // Select an assessment and jump to Explainability (with on-demand SHAP fetching)
  const handleSelectAssessment = async (record: AssessmentRecord) => {
    setSelectedRecord(record);
    setActiveView('explainability');

    // If SHAP values are empty, load them on-demand
    if (!record.prediction.shapValues || Object.keys(record.prediction.shapValues).length === 0) {
      try {
        const fullResult = await predictApplicant(record.applicant);
        
        const updatedRecord: AssessmentRecord = {
          ...record,
          prediction: {
            ...record.prediction,
            shapValues: fullResult.shapValues,
            baseValue: fullResult.baseValue,
          }
        };

        setSelectedRecord(prev => prev && prev.id === record.id ? updatedRecord : prev);
        setAssessments(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        setBatchResults(prev => prev.map(r => r.id === record.id ? updatedRecord : r));

        // Sync back to localStorage if permanent
        const cached = localStorage.getItem("credit_assessments_records");
        if (cached) {
          try {
            const list = JSON.parse(cached) as AssessmentRecord[];
            if (list.some(r => r.id === record.id)) {
              const updatedList = list.map(r => r.id === record.id ? updatedRecord : r);
              localStorage.setItem("credit_assessments_records", JSON.stringify(updatedList));
            }
          } catch (e) {
            console.error("LocalStorage write failed:", e);
          }
        }
      } catch (err) {
        console.error("Failed to load SHAP values on-demand:", err);
      }
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assessment', label: 'Single Assessment', icon: UserCheck },
    { id: 'batch', label: 'Batch Processing', icon: FileSpreadsheet },
    { id: 'explainability', label: 'Explainability (SHAP)', icon: Cpu },
  ];

  return (
    <div className="bg-[#0A0A0B] text-slate-200 min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/10 bg-[#111113] sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/favicon.jpg" alt="CREDINITY AI Logo" className="w-8 h-8 object-contain shadow-lg" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-mono flex items-center gap-1.5">
              CREDINITY <span className="text-blue-500">AI</span>
              <span className="inline-flex px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded text-[9px] font-mono border border-blue-500/20 font-medium">
                PRO
              </span>
            </h1>
            <p className="text-[9px] text-slate-500 font-mono tracking-wider uppercase hidden sm:block">
              AI-Powered Credit Risk Assessment Platform
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-2 h-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  setActiveView(item.id as ViewType);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                  isActive 
                    ? 'bg-white/5 border border-white/10 text-blue-400 font-semibold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right side utilities */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-400">API connected</span>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Tickers */}
      <div className="md:hidden border-b border-white/10 bg-[#111113]/80 backdrop-blur flex overflow-x-auto px-2 py-2 gap-1 scrollbar-none shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-mobile-${item.id}`}
              onClick={() => {
                setActiveView(item.id as ViewType);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono whitespace-nowrap transition ${
                isActive 
                  ? 'bg-white/5 border border-white/10 text-blue-400 font-semibold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={12} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Container Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            id="main-view-wrapper"
          >
            {activeView === 'dashboard' && (
              <DashboardView 
                assessments={assessments}
                onSelectAssessment={handleSelectAssessment}
                onNavigate={(v) => setActiveView(v)}
                onClearHistory={handleClearHistory}
              />
            )}

            {activeView === 'assessment' && (
              <AssessmentView 
                onAddAssessment={handleAddAssessment}
                onNavigateToExplainability={handleSelectAssessment}
              />
            )}

            {activeView === 'batch' && (
              <BatchView 
                onAddAssessmentsBatch={handleAddAssessmentsBatch}
                onSelectAssessment={handleSelectAssessment}
                onNavigate={(v) => setActiveView(v)}
                batchResults={batchResults}
                setBatchResults={setBatchResults}
                fileName={batchFileName}
                setFileName={setBatchFileName}
              />
            )}

            {activeView === 'explainability' && (
              <ExplainabilityView 
                assessments={assessments}
                selectedRecord={selectedRecord}
                onSelectRecord={handleSelectAssessment}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Status Bar */}
      <footer className="bg-[#111113] border-t border-white/10 flex flex-col md:flex-row items-center px-4 md:px-8 py-3 md:py-0 h-auto md:h-10 justify-between text-[10px] uppercase tracking-wider text-slate-500 font-mono shrink-0">
        <div className="flex flex-col md:flex-row gap-2 md:gap-8 items-center w-full justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> 
            API Status: Backend Connected
          </span>
          <span>Backend: FastAPI</span>
          <span>Model: Random Forest</span>
          <span>Dataset: Give Me Some Credit</span>
          <span>Version: v1.0</span>
        </div>
      </footer>
    </div>
  );
}
