import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, BarChart2 } from 'lucide-react';
import './App.css';

// --- 1. Type Definitions ---
interface DisaggregatedViolation {
    value: string;
    percentage: number;
}
interface Rule {
    rule_id: string;
    description: string;
    violations: number;
    disaggregated_violations?: DisaggregatedViolation[];
}
interface TrendPoint { period: string; violations: number; }
interface ActiveRule { rule_id: string; description: string; status: 'Active' | 'Paused'; monitored_objects: string[]; }
interface DashboardData { overall_compliance: number; total_violations: number; top_violated_rules: Rule[]; trend_data: TrendPoint[]; active_rules: ActiveRule[]; }

// --- 2. Mock Data ---
const mockDashboardData: DashboardData = {
    overall_compliance: 0.876,
    total_violations: 293,
    top_violated_rules: [
        {
            rule_id: "rule_001",
            description: "Payment must be recorded within 48 hours of invoice receipt.",
            violations: 150,
            disaggregated_violations: [
                { value: "Region A", percentage: 0.6 },
                { value: "Region B", percentage: 0.3 },
                { value: "Region C", percentage: 0.1 },
            ]
        },
        { rule_id: "rule_002", description: "Every 'Order' must have an associated 'Item' before shipping.", violations: 98 },
        { rule_id: "rule_003", description: "A 'Senior Manager' must approve any order over €5000.", violations: 45 },
        { rule_id: "rule_004", description: "Quality check must precede shipping.", violations: 21 },
    ],
    trend_data: [
        { period: "W27", violations: 50 }, { period: "W28", violations: 75 }, { period: "W29", violations: 65 },
        { period: "W30", violations: 80 }, { period: "W31", violations: 78 }, { period: "W32", violations: 95 },
    ],
    active_rules: [
        { rule_id: "rule_001", description: "Payment recorded within 48h.", status: "Active", monitored_objects: ["Order", "Invoice"] },
        { rule_id: "rule_002", description: "'Order' has 'Item' before ship.", status: "Active", monitored_objects: ["Order", "Shipment"] },
        { rule_id: "rule_003", description: "Approval for orders > €5k.", status: "Active", monitored_objects: ["Order", "Resource"] },
        { rule_id: "rule_004", description: "Quality check pre-shipping.", status: "Paused", monitored_objects: ["Item"] },
    ]
};

// --- 3. Animation Variants (Framer Motion) ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
};

// --- 4. Reusable UI Components ---
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <motion.div variants={itemVariants} className={`bg-slate-800/50 border border-slate-700/80 rounded-2xl shadow-lg ${className}`}>
        {children}
    </motion.div>
);

const StatusBadge: React.FC<{ status: 'Active' | 'Paused' }> = ({ status }) => {
    const styles = status === 'Active'
        ? "bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20"
        : "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20";
    return <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${styles}`}>{status}</span>;
};

// --- 5. Dashboard-Specific Components ---

const Header: React.FC = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <motion.header variants={itemVariants} className="mb-10 flex justify-between items-center">
            <div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Health Dashboard</h1>
                <p className="mt-2 text-slate-400">As of {formattedDate}</p>
            </div>
            <Link to="/definitions" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                Manage Definitions
            </Link>
        </motion.header>
    );
};

const SummaryCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <Card className="p-5">
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <div className="text-slate-500">{icon}</div>
        </div>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </Card>
);

const TrendChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => (
    <Card className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Violation Trend (Last 6 Weeks)</h3>
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(4px)', border: '1px solid #374151', borderRadius: '0.75rem' }}
                        cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }}
                    />
                    <Area type="monotone" dataKey="violations" stroke="#ef4444" strokeWidth={2} fill="url(#colorViolations)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </Card>
);

const SidebarSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <motion.div variants={itemVariants}>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </motion.div>
);

const ViolatedRuleItem: React.FC<{ rule: Rule }> = ({ rule }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-4 transition-colors hover:border-rose-500/50"
    >
        <p className="text-sm text-slate-200">{rule.description}</p>
        <p className="text-base font-bold text-rose-400 mt-2">{rule.violations.toLocaleString()} violations</p>

        {rule.disaggregated_violations && (
            <div className="mt-4 pt-3 border-t border-slate-700/80">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Violation Breakdown</h4>
                <div className="space-y-2">
                    {rule.disaggregated_violations.map(item => (
                        <div key={item.value} className="w-full">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-300">{item.value}</span>
                                <span className="text-xs font-mono text-slate-400">{(item.percentage * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div
                                    className="bg-rose-500 h-1.5 rounded-full"
                                    style={{ width: `${item.percentage * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </motion.div>
);

const ActiveRuleItem: React.FC<{ rule: ActiveRule }> = ({ rule }) => (
    <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/80 rounded-xl p-3">
        <div>
            <p className="text-sm font-medium text-slate-200">{rule.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {rule.monitored_objects.map(obj => (
                    <span key={obj} className="bg-sky-900/70 text-sky-300 text-xs font-medium px-2 py-0.5 rounded">
                        {obj}
                    </span>
                ))}
            </div>
        </div>
        <StatusBadge status={rule.status} />
    </div>
);

// --- 6. Main Page Component ---
const Dashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // The request now sends a POST request with an empty body
                const response = await fetch('http://localhost:8000/api/dashboard/summary', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}), // Empty body
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error("Failed to fetch dashboard data, using mock data.", error);
                setData(mockDashboardData);
            }
        };

        fetchData();
    }, []);

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <p className="text-white text-lg">Loading Dashboard...</p>
            </div>
        );
    }
    return (
        <div className="h-screen bg-slate-900 text-slate-300 font-sans overflow-y-auto">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900/30"></div>
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl opacity-40 animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full filter blur-3xl opacity-40 animate-pulse-slow"></div>
            </div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto"
            >
                {/* Main Content (Left two-thirds) */}
                <main className="lg:col-span-2 space-y-8">
                    <Header />
                    <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SummaryCard title="Compliance Score" value={`${(data.overall_compliance * 100).toFixed(1)}%`} icon={<CheckCircle size={20} />} />
                        <SummaryCard title="Total Violations" value={data.total_violations.toLocaleString()} icon={<AlertTriangle size={20} />} />
                        <SummaryCard title="Active Rules" value={data.active_rules.length.toString()} icon={<BarChart2 size={20} />} />
                    </motion.div>
                    <TrendChart data={data.trend_data} />
                </main>

                {/* Sidebar (Right one-third) */}
                <aside className="lg:col-span-1 space-y-10 lg:pt-28">
                    <SidebarSection title="Top Violated Rules">
                        {data.top_violated_rules.map(rule => <ViolatedRuleItem key={rule.rule_id} rule={rule} />)}
                    </SidebarSection>
                    <SidebarSection title="Rule Status">
                        {data.active_rules.map(rule => <ActiveRuleItem key={rule.rule_id} rule={rule} />)}
                    </SidebarSection>
                </aside>
            </motion.div>
        </div>
    );
};

export default Dashboard;