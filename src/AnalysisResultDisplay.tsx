// src/AnalysisResultDisplay.tsx
import React from 'react';
import { motion } from 'framer-motion';

// --- Type Definitions ---
interface AnalysisReportData {
  norm_id: string;
  description: string;
  run_timestamp: string;
  summary: {
    overall_compliance_percentage: number;
    total_instances: number;
    compliant_instances: number;
    violations: number;
    status: 'OK' | 'Warning' | 'Critical' | 'skipped';
    narrative: string;
  };
  results?: Array<{
    grouping_key: string[] | string;
    metrics: Record<string, number | string>;
    compliance_percentage: number;
  }>;
}

export interface AnalysisResponse {
  run_id: string;
  status: string;
  logs: string;
  reports: AnalysisReportData[];
  error?: string;
}

interface AnalysisResultDisplayProps {
  results: AnalysisResponse | null;
}

// --- Helper Components ---
const getStatusPill = (status: AnalysisReportData['summary']['status']) => {
  const baseClasses = "px-3 py-1 text-xs font-bold rounded-full text-white";
  switch (status) {
    case 'OK':
      return <span className={`${baseClasses} bg-green-500/80`}>OK</span>;
    case 'Warning':
      return <span className={`${baseClasses} bg-yellow-500/80`}>Warning</span>;
    case 'Critical':
      return <span className={`${baseClasses} bg-red-500/80`}>Critical</span>;
    case 'skipped':
       return <span className={`${baseClasses} bg-gray-500/80`}>Skipped</span>;
    default:
      return null;
  }
};

const MetricCard: React.FC<{ title: string; value: string | number; className?: string }> = ({ title, value, className }) => (
  <div className={`bg-slate-800/50 p-4 rounded-lg text-center ${className}`}>
    <p className="text-sm text-slate-400">{title}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

// --- Main Component ---
const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ results }) => {
  if (!results) {
    return <div className="text-slate-400 italic">Click 'Run Analysis' to see the results.</div>;
  }

  if (results.error) {
      return <div className="text-red-400">Error: {results.error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overall Run Summary */}
      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-2">Analysis Run Summary</h2>
        <p className="text-sm text-slate-400">Run ID: <span className="font-mono">{results.run_id}</span></p>
        <p className="text-sm text-slate-400">Status: <span className={`font-semibold ${results.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>{results.status}</span></p>
      </div>

      {/* Individual Reports */}
      {results.reports?.map((report, index) => (
        <motion.div
          key={report.norm_id}
          className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <header className="flex items-center justify-between p-4 bg-slate-800/60 border-b border-slate-700">
            <div>
              <h3 className="font-bold text-white">{report.norm_id}</h3>
              <p className="text-sm text-slate-400">{report.description}</p>
            </div>
            {getStatusPill(report.summary.status)}
          </header>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Compliance" value={`${report.summary.overall_compliance_percentage}%`} />
              <MetricCard title="Violations" value={report.summary.violations} />
              <MetricCard title="Compliant" value={report.summary.compliant_instances} />
              <MetricCard title="Total" value={report.summary.total_instances} />
            </div>

            <div>
              <h4 className="font-semibold text-slate-300 mb-1">Summary Narrative</h4>
              <p className="text-sm bg-slate-800/50 p-3 rounded-md text-slate-300 italic">
                {report.summary.narrative}
              </p>
            </div>

            {report.results && report.results.length > 1 && (
              <div>
                <h4 className="font-semibold text-slate-300 mb-2">Detailed Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="p-2">Grouping Key</th>
                        <th className="p-2 text-right">Compliance %</th>
                        {/* Dynamically create headers from the first result's metrics */}
                        {Object.keys(report.results[0].metrics).map(key => (
                          <th key={key} className="p-2 text-right">{key.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {report.results.map((res, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="p-2 font-mono">{Array.isArray(res.grouping_key) ? res.grouping_key.join(', ') : String(res.grouping_key)}</td>
                          <td className="p-2 text-right font-semibold">{res.compliance_percentage}%</td>
                          {Object.entries(res.metrics).map(([key, value]) => (
                             <td key={key} className="p-2 text-right font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
      
      {/* Logs Section */}
      <div>
        <details className="bg-slate-900/50 rounded-lg border border-slate-700">
          <summary className="cursor-pointer p-3 font-semibold text-slate-300">
            Show Raw Logs
          </summary>
          <div className="p-3 border-t border-slate-700">
            <pre className="w-full text-xs font-mono whitespace-pre-wrap overflow-x-auto h-48 text-slate-400 bg-slate-800 p-2 rounded">
              {results.logs || "No logs generated."}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
};

export default AnalysisResultDisplay;
