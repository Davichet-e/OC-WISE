// src/DefinitionEditor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, Save, PlusCircle } from 'lucide-react';
import { CreatedNorm } from './App';
import GraphNormCreatorInternal from './GraphNormCreator';
import { useGlobalConfig } from './GlobalConfig';
import { NormsTable } from './NormsTable';
import { ProcessDefinition } from './ProcessDefinitions';
import { useNavigate } from 'react-router-dom';


interface DefinitionEditorProps {
    initialData?: ProcessDefinition;
    onSave: (data: { name: string; schedule: string; norms: CreatedNorm[] }) => void;
    onCancel: () => void;
    isSaving: boolean;
}

const DefinitionEditor: React.FC<DefinitionEditorProps> = ({ initialData, onSave, onCancel, isSaving }) => {
    const [name, setName] = useState('');
    const [schedule, setSchedule] = useState('daily');
    const [norms, setNorms] = useState<CreatedNorm[]>([]);
    const [isNormCreatorVisible, setIsNormCreatorVisible] = useState(false);
    const { config: globalProcessConfig, setIsConfigSet } = useGlobalConfig();
    const navigate = useNavigate();

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setSchedule(initialData.schedule);
            setNorms(initialData.norms || []);
        } else {
            // Start with the norm creator open if it's a new definition
            setIsNormCreatorVisible(true);
        }
    }, [initialData]);

    const handleSave = () => {
        if (!name) {
            alert('Please provide a name for the definition.');
            return;
        }
        onSave({ name, schedule, norms });
    };

    const handleDeleteNorm = useCallback((normId: string) => {
        setNorms(currentNorms => currentNorms.filter(norm => norm.norm_id !== normId));
    }, []);

    const handleToggleNorm = useCallback((normId: string) => {
        setNorms(currentNorms =>
            currentNorms.map(norm =>
                norm.norm_id === normId ? { ...norm, enabled: !norm.enabled } : norm
            )
        );
    }, []);

    const handleBackToTechConfig = () => {
        setIsConfigSet(false);
        navigate('/configure');
    };

    const backdropVariants: Variants = {
        visible: { opacity: 1 },
        hidden: { opacity: 0 },
    };

    const modalVariants: Variants = {
        hidden: { y: "100vh", opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 20 } },
        exit: { y: "100vh", opacity: 0, transition: { duration: 0.3 } },
    };

    if (isNormCreatorVisible) {
        return (
            <div className="fixed inset-0 z-40">
                <GraphNormCreatorInternal
                    globalProcessConfig={globalProcessConfig}
                    onBackToTechConfig={handleBackToTechConfig}
                    createdNorms={norms}
                    setCreatedNorms={setNorms}
                    onDeleteNorm={handleDeleteNorm}
                    onToggleNorm={handleToggleNorm}
                    isEmbedded={true}
                />
                <button
                    onClick={() => setIsNormCreatorVisible(false)}
                    className="absolute bottom-5 right-5 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg z-50"
                >
                    Back to Definition
                </button>
            </div>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={backdropVariants}
                onClick={onCancel}
            >
                <motion.div
                    className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <header className="flex items-center justify-between p-6 border-b border-slate-700">
                        <h2 className="text-2xl font-bold text-white">
                            {initialData ? 'Edit Process Definition' : 'New Process Definition'}
                        </h2>
                        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </header>

                    {/* Main Content */}
                    <main className="flex-grow p-8 overflow-y-auto space-y-8">
                        {/* Definition Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="def-name" className="block text-sm font-medium text-slate-300 mb-2">Definition Name</label>
                                <input
                                    id="def-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., 'Weekly Compliance Check'"
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label htmlFor="def-schedule" className="block text-sm font-medium text-slate-300 mb-2">Run Schedule</label>
                                <select
                                    id="def-schedule"
                                    value={schedule}
                                    onChange={(e) => setSchedule(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </div>
                        </div>

                        {/* Norms Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white">Configured Norms ({norms.length})</h3>
                                <button
                                    onClick={() => setIsNormCreatorVisible(true)}
                                    className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    <PlusCircle size={20} />
                                    Add/Edit Norms
                                </button>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <NormsTable norms={norms} onDelete={handleDeleteNorm} onToggle={handleToggleNorm} />
                            </div>
                        </div>
                    </main>

                    {/* Footer */}
                    <footer className="flex justify-end items-center p-6 border-t border-slate-700 gap-4">
                        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={20} />
                            {isSaving ? 'Saving...' : 'Save Definition'}
                        </button>
                    </footer>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DefinitionEditor;
