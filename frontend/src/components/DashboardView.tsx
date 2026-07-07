import React, { useState } from "react";
import { motion } from "motion/react";
import { AssessmentRecord, ViewType } from "../types";
import { 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  Search, 
  FileText, 
  ArrowRight,
  Eye,
  Plus
} from "lucide-react";

interface DashboardViewProps {
  assessments: AssessmentRecord[];
  onSelectAssessment: (record: AssessmentRecord) => void;
  onNavigate: (view: ViewType) => void;
}

export default function DashboardView({ 
  assessments, 
  onSelectAssessment, 
  onNavigate 
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calculate metrics
  const totalApps = assessments.length;
  
  const getCountByRisk = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    return assessments.filter(a => a.prediction.riskLevel === level).length;
  };

  const lowCount = getCountByRisk('LOW');
  const mediumCount = getCountByRisk('MEDIUM');
  const highCount = getCountByRisk('HIGH');
  const criticalCount = getCountByRisk('CRITICAL');

  const lowPct = totalApps ? Math.round((lowCount / totalApps) * 100) : 0;
  const mediumPct = totalApps ? Math.round((mediumCount / totalApps) * 100) : 0;
  const highPct = totalApps ? Math.round(((highCount + criticalCount) / totalApps) * 100) : 0;

  // Filter and pagination
  const filtered = assessments.filter(record => 
    record.applicant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRiskBadgeStyles = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'CRITICAL':
        return 'bg-red-500/15 text-red-400 border border-red-500/30';
    }
  };

  return (
    <div className="space-y-6" id="dashboard-view-container">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Credit Portfolio Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time analytics and predictive credit risk health metrics.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            id="btn-nav-batch"
            onClick={() => onNavigate('batch')}
            className="flex items-center gap-2 px-4 py-2 bg-[#1C1C1F] hover:bg-white/5 text-slate-300 rounded-lg text-sm font-medium border border-white/10 transition"
          >
            <FileText size={16} />
            Batch Process CSV
          </button>
          <button
            id="btn-nav-assessment"
            onClick={() => onNavigate('assessment')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-blue-900/10"
          >
            <Plus size={16} />
            New Assessment
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="dashboard-kpis">
        {/* Card 1: Total Apps */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex items-center justify-between"
          id="kpi-total-apps"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total Applications</p>
            <h3 className="text-3xl font-semibold text-slate-100 mt-2 font-mono">{totalApps}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp size={12} className="text-green-500" />
              100% cloud verified
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users size={24} />
          </div>
        </motion.div>

        {/* Card 2: Low Risk % */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex items-center justify-between"
          id="kpi-low-risk"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Low Risk %</p>
            <h3 className="text-3xl font-semibold text-green-400 mt-2 font-mono">{lowPct}%</h3>
            <p className="text-xs text-slate-500 mt-1">
              {lowCount} of {totalApps} applicants
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <ShieldCheck size={24} />
          </div>
        </motion.div>

        {/* Card 3: Medium Risk % */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex items-center justify-between"
          id="kpi-medium-risk"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Medium Risk %</p>
            <h3 className="text-3xl font-semibold text-yellow-400 mt-2 font-mono">{mediumPct}%</h3>
            <p className="text-xs text-slate-500 mt-1">
              {mediumCount} of {totalApps} applicants
            </p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertTriangle size={24} />
          </div>
        </motion.div>

        {/* Card 4: High / Critical Risk % */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex items-center justify-between"
          id="kpi-high-risk"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">High / Critical %</p>
            <h3 className="text-3xl font-semibold text-red-400 mt-2 font-mono">{highPct}%</h3>
            <p className="text-xs text-slate-500 mt-1">
              {highCount + criticalCount} of {totalApps} applicants
            </p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert size={24} />
          </div>
        </motion.div>
      </div>

      {/* Distribution Chart and Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-graphics">
        {/* Risk Breakdown and Portfolio distribution */}
        <div className="lg:col-span-1 bg-[#161618] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Portfolio Default Risk</h3>
            <p className="text-xs text-slate-400 mt-1">Distribution of active scores against Random Forest priors.</p>
          </div>

          {/* Graphical stacked progress bar representing risk breakdown */}
          <div className="space-y-4 py-2">
            <div className="h-6 w-full rounded-full bg-white/5 overflow-hidden flex">
              <div 
                style={{ width: `${lowPct}%` }} 
                className="h-full bg-green-500 transition-all duration-500" 
                title={`Low Risk: ${lowPct}%`}
              />
              <div 
                style={{ width: `${mediumPct}%` }} 
                className="h-full bg-yellow-500 transition-all duration-500" 
                title={`Medium Risk: ${mediumPct}%`}
              />
              <div 
                style={{ width: `${highPct}%` }} 
                className="h-full bg-red-500 transition-all duration-500" 
                title={`High/Critical Risk: ${highPct}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1"></span>
                <span className="text-slate-400">Low ({lowCount})</span>
              </div>
              <div>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500 mr-1"></span>
                <span className="text-slate-400">Med ({mediumCount})</span>
              </div>
              <div>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1"></span>
                <span className="text-slate-400">High ({highCount + criticalCount})</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 text-xs text-slate-400 space-y-2">
            <div className="flex justify-between">
              <span>Avg Portfolio Probability:</span>
              <span className="font-mono text-slate-200">
                {totalApps 
                  ? `${Math.round((assessments.reduce((sum, a) => sum + a.prediction.score, 0) / totalApps) * 10) / 10}%` 
                  : "0%"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Random Forest ROC-AUC:</span>
              <span className="font-mono text-blue-400 font-bold">0.864</span>
            </div>
            <div className="flex justify-between">
              <span>Target Baseline Prior:</span>
              <span className="font-mono text-slate-200">15.0%</span>
            </div>
          </div>
        </div>

        {/* Recent Assessments List Table */}
        <div className="lg:col-span-2 bg-[#161618] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4" id="recent-assessments-panel">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recent Assessments</h3>
              <p className="text-xs text-slate-400 mt-1">Audit trail of latest individual evaluations.</p>
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input
                id="search-assessments"
                type="text"
                placeholder="Search applicant or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 bg-[#1C1C1F] border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto" id="assessments-table-wrapper">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Default Prob.</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.length > 0 ? (
                  paginated.map((record) => (
                    <tr 
                      key={record.id} 
                      className="hover:bg-white/5 transition-colors group"
                      id={`row-${record.id}`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-500 group-hover:text-blue-400 transition-colors">
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
                          id={`btn-view-explain-${record.id}`}
                          onClick={() => onSelectAssessment(record)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 font-mono transition-colors"
                        >
                          <Eye size={12} />
                          Explain (SHAP)
                          <ArrowRight size={10} className="transform group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No assessment history matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-500 font-mono">
            <span>
              Showing {filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
              {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
            </span>
            <div className="flex gap-1">
              <button
                id="btn-prev-page"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-[#1C1C1F] border border-white/5 rounded disabled:opacity-40 disabled:hover:bg-[#1C1C1F] hover:bg-white/5 transition"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  id={`btn-page-${page}`}
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 py-1 rounded border transition ${
                    currentPage === page 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-[#1C1C1F] border-white/5 hover:bg-white/5 text-slate-300"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                id="btn-next-page"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-[#1C1C1F] border border-white/5 rounded disabled:opacity-40 disabled:hover:bg-[#1C1C1F] hover:bg-white/5 transition"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
