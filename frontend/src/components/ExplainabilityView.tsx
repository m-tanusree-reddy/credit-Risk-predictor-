import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssessmentRecord } from "../types";
import { 
  Info, 
  ArrowUpRight, 
  ArrowDownRight, 
  HelpCircle, 
  ChevronDown, 
  User, 
  TrendingUp, 
  TrendingDown,
  Calendar
} from "lucide-react";

interface ExplainabilityViewProps {
  assessments: AssessmentRecord[];
  selectedRecord: AssessmentRecord | null;
  onSelectRecord: (record: AssessmentRecord) => void;
}

export default function ExplainabilityView({ 
  assessments, 
  selectedRecord,
  onSelectRecord
}: ExplainabilityViewProps) {
  const [isOpenSelector, setIsOpenSelector] = useState(false);

  const activeRecord = selectedRecord || (assessments.length > 0 ? assessments[0] : null);

  if (!activeRecord) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 bg-[#161618] border border-white/5 rounded-2xl space-y-4" id="explainability-empty">
        <HelpCircle size={48} className="text-slate-700 animate-pulse" />
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest font-mono">No Assessment Loaded</h2>
          <p className="text-xs text-slate-500 max-w-sm mt-2">
            Please run a Single Assessment, import a CSV database, or select an applicant from the Dashboard table to inspect credit underwriting decisions.
          </p>
        </div>
      </div>
    );
  }

  const { applicant, prediction } = activeRecord;

  // Feature label and explanation dictionary based on value and contributions
  const getFeatureDetails = (key: string, val: number, shapVal: number) => {
    switch (key) {
      case 'creditUtilization':
        return {
          label: 'Credit Utilization (%)',
          displayValue: `${val}%`,
          narrative: shapVal > 0 
            ? `Utilization of ${val}% exceeds the 30% optimal threshold, significantly increasing risk (+${shapVal}%).`
            : `Favorable utilization of ${val}% indicates disciplined credit usage, reducing default risk (${shapVal}%).`
        };
      case 'debtRatio':
        return {
          label: 'Debt-to-Income Ratio',
          displayValue: val.toFixed(2),
          narrative: shapVal > 0 
            ? `DTI ratio of ${val.toFixed(2)} is elevated, indicating heavy monthly obligations relative to cash flow (+${shapVal}%).`
            : `Conservative DTI ratio of ${val.toFixed(2)} leaves comfortable capital buffers, reducing risk (${shapVal}%).`
        };
      case 'income':
        return {
          label: 'Monthly Income ($)',
          displayValue: `$${val.toLocaleString()}`,
          narrative: shapVal < 0 
            ? `Strong monthly income stream of $${val.toLocaleString()} supports repayment security, reducing risk (${shapVal}%).`
            : `Limited income stream of $${val.toLocaleString()}/mo reduces cash flow flexibility (+${shapVal}%).`
        };
      case 'age':
        return {
          label: 'Applicant Age',
          displayValue: `${val} years`,
          narrative: shapVal < 0 
            ? `Mature age profile of ${val} years mathematically correlates with historical credit stability (${shapVal}%).`
            : `Younger age demographic of ${val} years indicates shorter credit history exposure (+${shapVal}%).`
        };
      case 'late90Plus':
        return {
          label: 'Severe Past Due (90d+)',
          displayValue: `${val} occurrences`,
          narrative: val > 0 
            ? `${val} severe historical default occurrences (90 days past due) represent critical default risk (+${shapVal}%).`
            : "No severe past due occurrences (90d+) recorded, indicating stable credit compliance."
        };
      case 'late3059':
        return {
          label: 'Minor Past Due (30-59d)',
          displayValue: `${val} occurrences`,
          narrative: val > 0 
            ? `${val} minor delinquency events in past 2 years elevate overall credit compliance risk (+${shapVal}%).`
            : "Zero minor past due occurrences (30-59d) recorded, confirming robust bill payment discipline."
        };
      case 'late6089':
        return {
          label: 'Moderate Past Due (60-89d)',
          displayValue: `${val} occurrences`,
          narrative: val > 0 
            ? `${val} moderate delinquency occurrences represent persistent credit compliance risk (+${shapVal}%).`
            : "No moderate delinquency occurrences (60-89d) recorded, confirming prompt repayment history."
        };
      case 'openCreditLines':
        return {
          label: 'Open Credit Accounts',
          displayValue: `${val} accounts`,
          narrative: shapVal > 0 
            ? `Elevated count of open credit lines (${val}) indicates higher potential debt capacity utilization (+${shapVal}%).`
            : `Optimal open account structure (${val}) provides sufficient credit exposure without leverage overload (${shapVal}%).`
        };
      case 'realEstateLoans':
        return {
          label: 'Real Estate Loans',
          displayValue: `${val} loans`,
          narrative: shapVal > 0
            ? `${val} real estate loan accounts add secured debt exposure to the profile (+${shapVal}%).`
            : `${val} real estate loan accounts do not materially elevate this applicant's modeled risk.`
        };
      case 'dependents':
        return {
          label: 'Dependents Count',
          displayValue: `${val}`,
          narrative: shapVal > 0 
            ? `${val} dependents increase overall non-discretionary household expenditures, adding slight risk (+${shapVal}%).`
            : "Minimal dependents reduce fixed household cash obligations, supporting credit buffer."
        };
      default:
        return {
          label: key,
          displayValue: String(val),
          narrative: `Feature contribution scored at ${shapVal > 0 ? '+' : ''}${shapVal}%.`
        };
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-green-400 border-green-500/20 bg-green-500/5';
      case 'MEDIUM': return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
      case 'HIGH': return 'text-red-400 border-red-500/20 bg-red-500/5';
      case 'CRITICAL': return 'text-red-400 border-red-500/30 bg-red-500/10';
      default: return 'text-slate-400 border-white/5 bg-[#161618]';
    }
  };

  const driversList = Object.entries(prediction.shapValues)
    .map(([feature, val]) => {
      const appVal = applicant[feature as keyof typeof applicant];
      return {
        feature,
        val: typeof appVal === 'number' ? appVal : 0,
        shap: val,
        ...getFeatureDetails(feature, typeof appVal === 'number' ? appVal : 0, val)
      };
    })
    .sort((a, b) => b.shap - a.shap); // Positive contributions (risk drivers) first

  const maxAbsShap = Math.max(...driversList.map(d => Math.abs(d.shap)), 1.0);

  return (
    <div className="space-y-6 animate-fadeIn" id="explainability-view-container">
      {/* Header and Applicant Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">SHAP Decision Explainability</h1>
          <p className="text-sm text-slate-400 mt-1 font-mono">
            Attributing credit default probability using exact Shapley values.
          </p>
        </div>

        {/* Custom Selector Dropdown */}
        <div className="relative" id="applicant-selector-wrapper">
          <button
            id="btn-toggle-selector"
            onClick={() => setIsOpenSelector(!isOpenSelector)}
            className="flex items-center justify-between gap-3 w-64 px-4 py-2 bg-[#1C1C1F] border border-white/10 rounded-lg text-xs font-mono text-slate-200 hover:border-slate-700 transition"
          >
            <div className="flex items-center gap-2 truncate">
              <User size={14} className="text-blue-500" />
              <span className="truncate">{applicant.name} (#{activeRecord.id})</span>
            </div>
            <ChevronDown size={14} className="text-slate-500" />
          </button>
          
          <AnimatePresence>
            {isOpenSelector && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsOpenSelector(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 mt-1 w-64 bg-[#1C1C1F] border border-white/10 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-white/5"
                  id="applicant-dropdown-list"
                >
                  {assessments.map((rec) => (
                    <button
                      id={`select-option-${rec.id}`}
                      key={rec.id}
                      onClick={() => {
                        onSelectRecord(rec);
                        setIsOpenSelector(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-mono flex items-center justify-between hover:bg-white/5 transition ${
                        rec.id === activeRecord.id ? "bg-white/5 text-blue-400 font-semibold" : "text-slate-300"
                      }`}
                    >
                      <span className="truncate">{rec.applicant.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">{rec.prediction.score}%</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="explainability-summary">
        {/* Card 1: Risk Level */}
        <div className={`p-5 rounded-2xl border ${getRiskColor(prediction.riskLevel)} flex items-center justify-between`}>
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400">Classified Tier</p>
            <h3 className="text-xl font-bold mt-1 tracking-tight">{prediction.riskLevel} RISK</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Based on {prediction.score}% default probability score.
            </p>
          </div>
        </div>

        {/* Card 2: SHAP Base Value */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#161618] flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400">Model Baseline Average</p>
            <h3 className="text-xl font-semibold text-slate-200 mt-1 font-mono">{prediction.baseValue}%</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
              The average expected risk score across all baseline applicants.
            </p>
          </div>
        </div>

        {/* Card 3: Contribution Margin */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#161618] flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400">Shapley Gap Attribution</p>
            {prediction.score >= prediction.baseValue ? (
              <h3 className="text-xl font-semibold text-red-400 mt-1 font-mono flex items-center gap-1">
                <TrendingUp size={18} />
                +{Math.round((prediction.score - prediction.baseValue) * 10) / 10}%
              </h3>
            ) : (
              <h3 className="text-xl font-semibold text-green-400 mt-1 font-mono flex items-center gap-1">
                <TrendingDown size={18} />
                {Math.round((prediction.score - prediction.baseValue) * 10) / 10}%
              </h3>
            )}
            <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
              Net cumulative push from all local financial variables.
            </p>
          </div>
        </div>
      </div>

      {/* SHAP Waterfall Attribution Graphic Chart */}
      <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4" id="shap-waterfall-card">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 font-mono">Local Attribution Waterfall</h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Visualizing how credit features shift probability from the baseline average ({prediction.baseValue}%) to the applicant&apos;s final default score ({prediction.score}%).
          </p>
        </div>

        {/* Custom SVG Waterfall Chart */}
        <div className="space-y-3.5 py-2" id="shap-waterfall-graphic">
          {driversList.map((driver) => {
            const isPositive = driver.shap > 0;
            const percentageWidth = Math.min((Math.abs(driver.shap) / maxAbsShap) * 100, 100);
            
            return (
              <div key={driver.feature} className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 text-xs">
                {/* Feature Name */}
                <div className="md:col-span-3 text-slate-300 font-medium font-mono truncate">
                  {driver.label}
                </div>

                {/* Actual Value */}
                <div className="md:col-span-2 text-slate-500 font-mono">
                  Val: <span className="text-slate-300 font-semibold">{driver.displayValue}</span>
                </div>

                {/* Graphical bar */}
                <div className="md:col-span-5 flex items-center h-4 relative">
                  {/* Baseline indicator line in the center */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
                  
                  {isPositive ? (
                    // Red bar pushing right (increased risk)
                    <div className="w-1/2 ml-[50%] flex justify-start">
                      <div 
                        style={{ width: `${percentageWidth / 2}%` }} 
                        className="h-3.5 bg-red-500/80 rounded-r border-r border-red-400/50 hover:bg-red-500 transition-all duration-500" 
                      />
                    </div>
                  ) : (
                    // Green bar pushing left (decreased risk)
                    <div className="w-1/2 mr-[50%] flex justify-end">
                      <div 
                        style={{ width: `${percentageWidth / 2}%` }} 
                        className="h-3.5 bg-green-500/80 rounded-l border-l border-green-400/50 hover:bg-green-500 transition-all duration-500" 
                      />
                    </div>
                  )}
                </div>

                {/* SHAP numerical value */}
                <div className={`md:col-span-2 font-mono text-right font-bold ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
                  {isPositive ? `+${driver.shap}%` : `${driver.shap}%`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-3 border-t border-white/5">
          <span>&larr; REDUCES RISK (GREEN)</span>
          <span>BASELINE expectation = {prediction.baseValue}%</span>
          <span>ELEVATES RISK (RED) &rarr;</span>
        </div>
      </div>

      {/* Feature Narrative Breakdown */}
      <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4" id="shap-narrative-card">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-blue-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 font-mono">Decisions &amp; Underwriting Explanations</h2>
        </div>

        <div className="divide-y divide-white/5" id="shap-narrative-list">
          {driversList.map((driver) => {
            const isRiskIncreaser = driver.shap > 0;
            return (
              <div key={driver.feature} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start gap-3">
                <div className="md:w-1/4 shrink-0">
                  <span className="text-xs font-semibold text-slate-200 block">{driver.label}</span>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Value: {driver.displayValue}</span>
                </div>
                
                <div className="flex-1 text-xs text-slate-400 leading-relaxed font-sans">
                  {driver.narrative}
                </div>

                <div className="shrink-0 flex items-center gap-1 font-mono font-bold text-xs">
                  {driver.shap !== 0 ? (
                    <>
                      <span className={isRiskIncreaser ? 'text-red-400' : 'text-green-400'}>
                        {isRiskIncreaser ? <ArrowUpRight size={14} className="inline mr-0.5" /> : <ArrowDownRight size={14} className="inline mr-0.5" />}
                        {isRiskIncreaser ? '+' : ''}{driver.shap}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">Neutral</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
