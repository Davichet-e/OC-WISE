import React from 'react';
import { motion } from 'framer-motion';

// --- Type Definitions ---
interface ProcessDefinition {
    id: string;
    name: string;
    schedule: string;
    last_run_compliance: number;
}

// --- Helper Component ---
const CompliancePill: React.FC<{ score: number }> = ({ score }) => {
    const getColor = () => {
        if (score > 95) return 'bg-green-500/20 text-green-300';
        if (score > 85) return 'bg-yellow-500/20 text-yellow-300';
        return 'bg-red-500/20 text-red-300';
    };
    return <span className={`px-2 py-1 text-xs font-bold rounded-full ${getColor()}`}>{score.toFixed(1)}%</span>;
};

// --- Main Component ---
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

export default ProcessDefinitionList;