import { Link } from 'react-router-dom';
import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion, Variants } from 'framer-motion';
import { Activity, FileText } from 'lucide-react';
import './App.css';
import AnalysisResultDisplay, { AnalysisResponse } from './AnalysisResultDisplay.tsx';

// --- 1. Type Definitions ---
interface Rule {
    rule_id: string;
    description: string;
    violations: number;
}
interface TrendPoint {
    period: string;
    violations: number;
    runId: string;
}
interface ProcessDefinition {
    id: string;
    name: string;
    schedule: string;
    last_run_compliance: number;
}
interface ProcessRun {
    id: string;
    iteration: number;
    timestamp: string;
}
interface ProcessDefinitionDetails {
    id: string;
    name: string;
    runs: ProcessRun[];
    top_violated_rules: Rule[];
}

// --- 2. Mock Data ---
const mockProcessDefinitions: ProcessDefinition[] = [
    { id: 'proc_def_1', name: 'Order to Cash', schedule: 'Daily', last_run_compliance: 91.2 },
    { id: 'proc_def_2', name: 'Procure to Pay', schedule: 'Weekly', last_run_compliance: 98.0 },
    { id: 'proc_def_3', name: 'Issue to Resolution', schedule: 'Daily', last_run_compliance: 82.0 },
];


const generateMockRuns = (count: number, prefix: string) => {
    return Array.from({ length: count }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (count - 1 - i) * 7); // Corrected date logic
        return {
            id: `${prefix}_run_${i + 1}`,
            iteration: i + 1,
            timestamp: date.toISOString(),
        };
    }).slice(-5);
};

// --- Mock Details for EACH process definition ---
const mockDetails1: ProcessDefinitionDetails = {
    id: 'proc_def_1',
    name: 'Order to Cash',
    runs: generateMockRuns(5, 'o2c'),
    top_violated_rules: [
        { rule_id: "rule_o2c_01", description: "Invoice must be generated within 24h of shipping.", violations: 40 },
        { rule_id: "rule_o2c_02", description: "Credit check required for new customers.", violations: 25 },
    ]
};
const mockDetails2: ProcessDefinitionDetails = {
    id: 'proc_def_2',
    name: 'Procure to Pay',
    runs: generateMockRuns(5, 'p2p'),
    top_violated_rules: [
        { rule_id: "rule_p2p_01", description: "Purchase Order must be approved before sending to vendor.", violations: 35 },
        { rule_id: "rule_p2p_02", description: "Three-way matching (PO, Invoice, Receipt) must be completed.", violations: 15 },
    ]
};
const mockDetails3: ProcessDefinitionDetails = {
    id: 'proc_def_3',
    name: 'Issue to Resolution',
    runs: generateMockRuns(5, 'i2r'),
    top_violated_rules: [
        { rule_id: "rule_i2r_01", description: "High-priority tickets must be acknowledged within 1 hour.", violations: 50 },
    ]
};

// --- Mock Database for details ---
const mockProcessDetailsDatabase: { [key: string]: ProcessDefinitionDetails } = {
    'proc_def_1': mockDetails1,
    'proc_def_2': mockDetails2,
    'proc_def_3': mockDetails3,
};

// --- MOCK ANALYSIS FOR ALL RUNS ---
const mockAnalysisResponses: { [key: string]: AnalysisResponse } = {
    // Order to Cash Runs
    'o2c_run_1': { run_id: 'o2c_run_1', status: 'completed', logs: 'Log for O2C run 1...', reports: [{ norm_id: 'O2C Norm', description: 'Run 1 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 95.0, total_instances: 100, compliant_instances: 95, violations: 5, status: 'OK', narrative: 'Initial run shows high compliance.' } }] },
    'o2c_run_2': { run_id: 'o2c_run_2', status: 'completed', logs: 'Log for O2C run 2...', reports: [{ norm_id: 'O2C Norm', description: 'Run 2 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 92.5, total_instances: 110, compliant_instances: 102, violations: 8, status: 'Warning', narrative: 'Slight dip in compliance this week.' } }] },
    'o2c_run_3': { run_id: 'o2c_run_3', status: 'completed', logs: 'Log for O2C run 3...', reports: [{ norm_id: 'O2C Norm', description: 'Run 3 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 96.0, total_instances: 105, compliant_instances: 101, violations: 4, status: 'OK', narrative: 'Compliance back to excellent levels.' } }] },
    'o2c_run_4': { run_id: 'o2c_run_4', status: 'completed', logs: 'Log for O2C run 4...', reports: [{ norm_id: 'O2C Norm', description: 'Run 4 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 88.0, total_instances: 130, compliant_instances: 114, violations: 16, status: 'Critical', narrative: 'A significant number of violations were detected, investigation required.' } }] },
    'o2c_run_5': {
        run_id: 'o2c_run_5', status: 'completed', logs: 'Log for O2C run 5...',
        reports: [{
            norm_id: 'O2C Norm: Timely Invoicing', description: 'Invoice must be generated within 24h of shipping.', run_timestamp: '2023-01-29',
            summary: { overall_compliance_percentage: 91.2, total_instances: 125, compliant_instances: 114, violations: 11, status: 'Warning', narrative: 'Improving but still requires attention, especially with Vendor B.' },
            results: [
                { grouping_key: 'Vendor A', metrics: { 'Total Orders': 80, 'Violations': 3, 'Avg. Time (h)': 18.5 }, compliance_percentage: 96.3 },
                { grouping_key: 'Vendor B', metrics: { 'Total Orders': 30, 'Violations': 7, 'Avg. Time (h)': 29.1 }, compliance_percentage: 76.7 },
                { grouping_key: 'Vendor C', metrics: { 'Total Orders': 15, 'Violations': 1, 'Avg. Time (h)': 22.0 }, compliance_percentage: 93.3 }
            ]
        }]
    },
    // Procure to Pay Runs
    'p2p_run_1': { run_id: 'p2p_run_1', status: 'completed', logs: 'Log for P2P run 1...', reports: [{ norm_id: 'P2P Norm', description: 'Run 1 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 99.0, total_instances: 180, compliant_instances: 178, violations: 2, status: 'OK', narrative: 'Excellent start.' } }] },
    'p2p_run_2': { run_id: 'p2p_run_2', status: 'completed', logs: 'Log for P2P run 2...', reports: [{ norm_id: 'P2P Norm', description: 'Run 2 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 98.5, total_instances: 190, compliant_instances: 187, violations: 3, status: 'OK', narrative: 'Consistently high performance.' } }] },
    'p2p_run_3': { run_id: 'p2p_run_3', status: 'completed', logs: 'Log for P2P run 3...', reports: [{ norm_id: 'P2P Norm', description: 'Run 3 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 99.5, total_instances: 200, compliant_instances: 199, violations: 1, status: 'OK', narrative: 'Near perfect compliance.' } }] },
    'p2p_run_4': { run_id: 'p2p_run_4', status: 'completed', logs: 'Log for P2P run 4...', reports: [{ norm_id: 'P2P Norm', description: 'Run 4 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 97.0, total_instances: 195, compliant_instances: 190, violations: 5, status: 'Warning', narrative: 'Minor issues detected with new vendor onboarding.' } }] },
    'p2p_run_5': { run_id: 'p2p_run_5', status: 'completed', logs: 'Log for P2P run 5...', reports: [{ norm_id: 'P2P Norm', description: 'P2P Run 5', run_timestamp: '2023-01-29', summary: { overall_compliance_percentage: 98.0, total_instances: 200, compliant_instances: 196, violations: 4, status: 'OK', narrative: 'Excellent compliance, issues from last week resolved.' } }] },
    // Issue to Resolution Runs
    'i2r_run_1': { run_id: 'i2r_run_1', status: 'completed', logs: 'Log for I2R run 1...', reports: [{ norm_id: 'I2R Norm', description: 'Run 1 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 75.0, total_instances: 80, compliant_instances: 60, violations: 20, status: 'Critical', narrative: 'Initial run shows major SLA breaches.' } }] },
    'i2r_run_2': { run_id: 'i2r_run_2', status: 'completed', logs: 'Log for I2R run 2...', reports: [{ norm_id: 'I2R Norm', description: 'Run 2 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 80.0, total_instances: 85, compliant_instances: 68, violations: 17, status: 'Critical', narrative: 'Slight improvement after process changes.' } }] },
    'i2r_run_3': { run_id: 'i2r_run_3', status: 'completed', logs: 'Log for I2R run 3...', reports: [{ norm_id: 'I2R Norm', description: 'Run 3 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 85.0, total_instances: 88, compliant_instances: 75, violations: 13, status: 'Warning', narrative: 'Compliance is improving steadily.' } }] },
    'i2r_run_4': { run_id: 'i2r_run_4', status: 'completed', logs: 'Log for I2R run 4...', reports: [{ norm_id: 'I2R Norm', description: 'Run 4 Analysis', run_timestamp: '', summary: { overall_compliance_percentage: 90.0, total_instances: 92, compliant_instances: 83, violations: 9, status: 'Warning', narrative: 'Now meeting minimum acceptable levels.' } }] },
    'i2r_run_5': { run_id: 'i2r_run_5', status: 'completed', logs: 'Log for I2R run 5...', reports: [{ norm_id: 'I2R Norm', description: 'I2R Run 5', run_timestamp: '2023-01-29', summary: { overall_compliance_percentage: 82.0, total_instances: 90, compliant_instances: 74, violations: 16, status: 'Critical', narrative: 'Regression detected. High priority SLA misses have returned.' } }] },
};


// --- 3. Animation Variants ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

// --- 4. Reusable UI Components ---
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <motion.div variants={itemVariants} className={`bg-slate-800/50 border border-slate-700/80 rounded-2xl shadow-lg ${className}`}>
        {children}
    </motion.div>
);

// --- 5. Dashboard-Specific Components ---
const Header: React.FC = () => (
    <motion.header variants={itemVariants} className="mb-10 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Health Dashboard</h1>
            <p className="mt-2 text-slate-400">Live compliance and process monitoring.</p>
        </div>
        <Link to="/definitions" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Manage Definitions
        </Link>
    </motion.header>
);

const TrendChart: React.FC<{ data: TrendPoint[]; onPointClick: (runId: string) => void; selectedDefinitionRunDetails: ProcessRun[] }> = ({ data, onPointClick, selectedDefinitionRunDetails }) => (
    <Card className="p-6 col-span-1 md:col-span-3">
        <h3 className="text-lg font-medium text-white mb-4">Violation Trend (Last 5 Runs)</h3>
        <div style={{ width: '100%', height: 700 }}>
            <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} onClick={(e: any) => {
                    console.log(e);

                    if (e && e.activeTooltipIndex) { onPointClick(selectedDefinitionRunDetails[e.activeTooltipIndex].id); }
                }}>
                    <defs><linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="period" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#475569' }} />
                    <Legend />
                    <Area type="monotone" dataKey="violations" stroke="#ef4444" fillOpacity={1} fill="url(#colorViolations)" name="Violations" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </Card>
);

const SidebarSection: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <motion.div variants={itemVariants}>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 flex items-center">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
        </h3>
        <div className="space-y-4">{children}</div>
    </motion.div>
);

const CompliancePill: React.FC<{ score: number }> = ({ score }) => {
    const getColor = () => {
        if (score > 95) return 'bg-green-500/20 text-green-300';
        if (score > 85) return 'bg-yellow-500/20 text-yellow-300';
        return 'bg-red-500/20 text-red-300';
    };
    return <span className={`px-2 py-1 text-xs font-bold rounded-full ${getColor()}`}>{score.toFixed(1)}%</span>;
};

const ProcessDefinitionList: React.FC<{
    definitions: ProcessDefinition[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}> = ({ definitions, selectedId, onSelect }) => (
    <div className="space-y-2">
        {definitions.map(def => (
            <button
                key={def.id}
                onClick={() => onSelect(def.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors border ${selectedId === def.id ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-700/50'}`}
            >
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-white">{def.name}</p>
                    <CompliancePill score={def.last_run_compliance} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Schedule: {def.schedule}</p>
            </button>
        ))}
    </div>
);


// --- 6. Main Page Component ---
const Dashboard: React.FC = () => {
    const [processDefinitions, setProcessDefinitions] = useState<ProcessDefinition[]>([]);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
    const [selectedDefinitionDetails, setSelectedDefinitionDetails] = useState<ProcessDefinitionDetails | null>(null);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
    console.log(selectedRunId, selectedDefinitionId, selectedDefinitionDetails);

    useEffect(() => {
        setProcessDefinitions(mockProcessDefinitions);
        if (mockProcessDefinitions.length > 0 && !selectedDefinitionId) {
            setSelectedDefinitionId(mockProcessDefinitions[0].id);
        }
    }, []);

    useEffect(() => {
        if (!selectedDefinitionId) return;

        const details = mockProcessDetailsDatabase[selectedDefinitionId];
        setSelectedDefinitionDetails(details);

        if (details && details.runs.length > 0) {
            const mostRecentRun = details.runs[details.runs.length - 1];
            setSelectedRunId(mostRecentRun.id);
        } else {
            setSelectedRunId(null);
        }
    }, [selectedDefinitionId]);

    useEffect(() => {
        if (!selectedRunId) {
            setAnalysisResult(null);
            return;
        }
        setAnalysisResult(mockAnalysisResponses[selectedRunId] || { run_id: selectedRunId, status: 'error', logs: '', reports: [], error: 'Analysis data not found.' });
    }, [selectedRunId]);

    const handleRunSelection = (runId: string) => {
        setSelectedRunId(runId);
    };

    const trendData = useMemo(() => {
        if (selectedDefinitionDetails) {
            // Use violation counts from the mock analysis for consistency
            return selectedDefinitionDetails.runs.map(run => {
                const analysis = mockAnalysisResponses[run.id];
                const violations = analysis?.reports[0]?.summary.violations ?? 0;
                return {
                    period: new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    violations: violations,
                    runId: run.id,
                };
            });
        }
        return [];
    }, [selectedDefinitionDetails]);

    if (processDefinitions.length === 0) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white text-lg">Loading Dashboard...</p></div>;
    }

    return (
        <div className="h-screen bg-slate-900 text-slate-300 font-sans overflow-y-auto">
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900/30" />

            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
                <main className="lg:col-span-2 space-y-8">
                    <Header />
                    {selectedDefinitionDetails ? (
                        <motion.div variants={containerVariants}>
                            <TrendChart data={trendData} onPointClick={handleRunSelection} selectedDefinitionRunDetails={selectedDefinitionDetails?.runs} />
                        </motion.div>
                    ) : (
                        <Card className="p-6"><p>Select a process definition to view its health.</p></Card>
                    )}
                </main>

                <aside className="lg:col-span-1 space-y-10 lg:pt-28">
                    <SidebarSection title="Process Definitions" icon={<FileText size={16} />}>
                        <ProcessDefinitionList
                            definitions={processDefinitions}
                            selectedId={selectedDefinitionId}
                            onSelect={setSelectedDefinitionId}
                        />
                    </SidebarSection>

                    {selectedDefinitionDetails && (
                        <SidebarSection title={`${selectedDefinitionDetails.name} - Run Breakdown`} icon={<Activity size={16} />}>
                            {analysisResult ? (
                                <AnalysisResultDisplay key={selectedRunId} results={analysisResult} />
                            ) : (
                                <Card className="p-4">
                                    <p className="text-sm text-slate-400 text-center">No run selected or analysis data missing.</p>
                                </Card>
                            )}
                        </SidebarSection>
                    )}
                </aside>
            </motion.div>
        </div>
    );
};

export default Dashboard;

