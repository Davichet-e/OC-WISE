import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Play, Trash2, Edit, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import DefinitionEditor from './DefinitionEditor';
import { CreatedNorm } from './App';

export interface ProcessDefinition {
    definition_id: string;
    name: string;
    schedule: string;
    norms?: CreatedNorm[]; // Make norms optional for list view
}

// --- API Helper Functions ---

const api = {
    getDefinitions: async (): Promise<ProcessDefinition[]> => {
        const response = await fetch('http://localhost:8000/api/process-definitions');
        if (!response.ok) throw new Error('Failed to fetch definitions');
        return response.json();
    },
    getDefinition: async (id: string): Promise<ProcessDefinition> => {
        const response = await fetch(`http://localhost:8000/api/process-definitions/${id}`);
        if (!response.ok) throw new Error('Failed to fetch definition details');
        return response.json();
    },
    createDefinition: async (data: { name: string; schedule: string; norms: CreatedNorm[] }): Promise<ProcessDefinition> => {
        const response = await fetch('http://localhost:8000/api/process-definitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create definition');
        return response.json();
    },
    updateDefinition: async (id: string, data: { name: string; schedule: string; norms: CreatedNorm[] }): Promise<ProcessDefinition> => {
        const response = await fetch(`http://localhost:8000/api/process-definitions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update definition');
        return response.json();
    },
    deleteDefinition: async (id: string): Promise<void> => {
        const response = await fetch(`http://localhost:8000/api/process-definitions/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete definition');
    },
    runDefinition: async (id: string): Promise<any> => {
        const response = await fetch(`http://localhost:8000/api/process-definitions/${id}/run`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to run definition');
        return response.json();
    },
};


// --- Components ---

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const Header: React.FC<{ onNew: () => void }> = ({ onNew }) => (
    <motion.header variants={itemVariants} className="mb-10 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Process Definitions</h1>
            <p className="mt-2 text-slate-400">Manage and run your defined process norm configurations.</p>
        </div>
        <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-300 hover:text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                <ArrowLeft size={18} />
                Dashboard
            </Link>
            <button onClick={onNew} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                <PlusCircle size={20} />
                New Definition
            </button>
        </div>
    </motion.header>
);

const DefinitionCard: React.FC<{ def: ProcessDefinition; onEdit: () => void; onDelete: () => void; onRun: () => void; }> = ({ def, onEdit, onDelete, onRun }) => (
    <motion.div variants={itemVariants} className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 flex justify-between items-center">
        <div>
            <h3 className="text-xl font-bold text-white">{def.name}</h3>
            <p className="text-slate-400 capitalize mt-1">Schedule: <span className="font-semibold text-slate-300">{def.schedule}</span></p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={onRun} title="Run Now" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"><Play size={20} /></button>
            <button onClick={onEdit} title="Edit" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"><Edit size={20} /></button>
            <button onClick={onDelete} title="Delete" className="p-2 text-rose-400 hover:text-white hover:bg-rose-500/50 rounded-full transition-colors"><Trash2 size={20} /></button>
        </div>
    </motion.div>
);

const Notification: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => (
    <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 ${type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'}`}
    >
        {type === 'success' ? <CheckCircle /> : <AlertTriangle />}
        <span>{message}</span>
        <button onClick={onDismiss} className="ml-4">&times;</button>
    </motion.div>
);


const ProcessDefinitions: React.FC = () => {
    const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingDefinition, setEditingDefinition] = useState<ProcessDefinition | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchDefinitions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getDefinitions();
            setDefinitions(data);
        } catch (error) {
            showNotification('Failed to fetch definitions.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDefinitions();
    }, [fetchDefinitions]);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleNew = () => {
        setEditingDefinition(null);
        setIsEditorOpen(true);
    };

    const handleEdit = async (def: ProcessDefinition) => {
        try {
            const fullDef = await api.getDefinition(def.definition_id);
            setEditingDefinition(fullDef);
            setIsEditorOpen(true);
        } catch (error) {
            showNotification('Failed to load definition details.', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this definition?')) {
            try {
                await api.deleteDefinition(id);
                showNotification('Definition deleted successfully.', 'success');
                fetchDefinitions();
            } catch (error) {
                showNotification('Failed to delete definition.', 'error');
            }
        }
    };

    const handleRun = async (id: string) => {
        try {
            await api.runDefinition(id);
            showNotification('Analysis run started successfully.', 'success');
        } catch (error) {
            showNotification('Failed to start analysis run.', 'error');
        }
    };

    const handleSave = async (data: { name: string; schedule: string; norms: CreatedNorm[] }) => {
        setIsSaving(true);
        try {
            if (editingDefinition) {
                await api.updateDefinition(editingDefinition.definition_id, data);
                showNotification('Definition updated successfully.', 'success');
            } else {
                await api.createDefinition(data);
                showNotification('Definition created successfully.', 'success');
            }
            setIsEditorOpen(false);
            fetchDefinitions();
        } catch (error) {
            showNotification(editingDefinition ? 'Failed to update definition.' : 'Failed to create definition.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-8">
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900/30" />
            {notification && <Notification {...notification} onDismiss={() => setNotification(null)} />}

            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 max-w-4xl mx-auto">
                <Header onNew={handleNew} />
                {loading ? (
                    <p>Loading definitions...</p>
                ) : (
                    <div className="space-y-6">
                        {definitions.length > 0 ? (
                            definitions.map(def => (
                                <DefinitionCard
                                    key={def.definition_id}
                                    def={def}
                                    onEdit={() => handleEdit(def)}
                                    onDelete={() => handleDelete(def.definition_id)}
                                    onRun={() => handleRun(def.definition_id)}
                                />
                            ))
                        ) : (
                            <motion.div variants={itemVariants} className="text-center py-12 bg-slate-800/40 rounded-2xl">
                                <h3 className="text-xl font-semibold text-white">No Process Definitions Found</h3>
                                <p className="text-slate-400 mt-2">Click "New Definition" to get started.</p>
                            </motion.div>
                        )}
                    </div>
                )}
            </motion.div>

            {isEditorOpen && (
                <DefinitionEditor
                    initialData={editingDefinition || undefined}
                    onSave={handleSave}
                    onCancel={() => setIsEditorOpen(false)}
                    isSaving={isSaving}
                />
            )}
        </div>
    );
};

export default ProcessDefinitions;
