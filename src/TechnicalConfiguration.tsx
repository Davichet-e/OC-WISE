import React, { useState, useEffect } from 'react';
import { GlobalProcessConfig, useGlobalConfig } from './GlobalConfig';

// Helper components (mimicking shadcn/ui with Tailwind)

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 ${className}`}>
        {children}
    </div>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`mb-4 ${className}`}>
        {children}
    </div>
);

const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <h2 className={`text-2xl font-semibold text-gray-900 dark:text-white ${className}`}>
        {children}
    </h2>
);

const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <p className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        {children}
    </p>
);

const Label: React.FC<{ htmlFor: string; children: React.ReactNode; className?: string }> = ({ htmlFor, children, className }) => (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}>
        {children}
    </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className={`mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${props.className}`}
    />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'secondary' }> = ({ children, className, variant = 'default', ...props }) => {
    const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";
    let variantStyle = "";
    switch (variant) {
        case 'outline':
            variantStyle = "bg-transparent border border-input text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700";
            break;
        case 'secondary':
            variantStyle = "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600";
            break;
        default: // default
            variantStyle = "bg-indigo-600 text-white hover:bg-indigo-700";
    }
    return (
        <button className={`${baseStyle} ${variantStyle} px-4 py-2 ${className}`} {...props}>
            {children}
        </button>
    );
};

const Progress: React.FC<{ value: number; max: number; className?: string }> = ({ value, max, className }) => (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4 ${className}`}>
        <div
            className="bg-indigo-600 h-2.5 rounded-full"
            style={{ width: `${(value / max) * 100}%` }}
        ></div>
    </div>
);

const Tooltip: React.FC<{ children: React.ReactNode, content: string }> = ({ children, content }) => (
    <div className="relative inline-block group">
        {children}
        <div
            className="absolute bottom-full left-1/2 z-20 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
                minWidth: 100,
                maxWidth: 200,
                width: 'max-content',
                left: '50%',
                transform: 'translateX(-50%)',
                wordBreak: 'break-word',
                whiteSpace: 'normal',
                boxSizing: 'border-box',
                pointerEvents: 'none',
            }}
        >
            {content}
            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
        </div>
    </div>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block ml-1 text-gray-400 dark:text-gray-500 ${className}`}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);


interface ConfigStep {
    id: number;
    title: string;
    description: string;
    fields: Array<keyof GlobalProcessConfig>;
}

const steps: ConfigStep[] = [
    {
        id: 1,
        title: 'Core Node Labels',
        description: 'Define the fundamental labels used to identify different types of nodes in your process graph.',
        fields: ['eventNodeLabel', 'entityNodeLabel'],
    },
    {
        id: 2,
        title: 'Key Node Properties',
        description: 'Specify the property names on your nodes that store critical information like activity names, entity types, and timestamps.',
        fields: ['activityProperty', 'entityFilterProperty', 'timestampProperty'],
    },
    {
        id: 3,
        title: 'Core Relationship Names',
        description: 'Define the names of essential relationships connecting nodes in your process graph.',
        fields: ['corrRelName', 'dfEntityRelName'],
    },
    {
        id: 4,
        title: 'Attribute Storage',
        description: 'Specify if attributes are stored as properties on the node or as separate nodes connected by a relationship.',
        fields: ['attributeStorage', 'attributeRelName', 'attributeNodeLabel', 'attributeNameProperty', 'attributeValueProperty'],
    },
    {
        id: 5,
        title: 'DF Relationship Type Distinction',
        description: 'Specify how the type of DF relationship is distinguished: by edge label or by a property on the edge.',
        fields: ['dfTypeDistinction', 'dfBaseRelName', 'dfTypePropertyName'],
    },
];

const fieldDetails: Record<keyof GlobalProcessConfig, { label: string; placeholder: string; tooltip: string }> = {
    eventNodeLabel: { label: 'Event Node Label', placeholder: 'e.g., Event, Task, LogEntry', tooltip: 'The label used in your Neo4j graph for nodes representing individual events or activities.' },
    entityNodeLabel: { label: 'Entity Node Label', placeholder: 'e.g., Entity, Case, Document', tooltip: 'The label for nodes representing business objects that events relate to (e.g., Purchase Order, Invoice).' },
    activityProperty: { label: 'Activity Property Name (on Events)', placeholder: 'e.g., activity, name, concept:name', tooltip: 'The property key on Event nodes that stores the name or type of the activity performed.' },
    entityFilterProperty: { label: 'Entity Type Property Name (on Entities)', placeholder: 'e.g., type, category, object_type', tooltip: 'The property key on Entity nodes used to distinguish different kinds of entities (e.g., "Invoice" vs "Order").' },
    timestampProperty: { label: 'Timestamp Property Name (on Events)', placeholder: 'e.g., timestamp, time:timestamp, endTime', tooltip: 'The property key on Event nodes that stores the occurrence time of the event.' },
    corrRelName: { label: 'Event-Entity Correlation Name', placeholder: 'e.g., CORR, OBSERVED_IN, BELONGS_TO', tooltip: 'The relationship type linking an event to an entity it involves or affects.' },
    dfEntityRelName: { label: 'Entity-Entity DF Relation Name', placeholder: 'e.g., DF_ENTITY, FOLLOWS_BY', tooltip: 'The relationship type indicating one entity directly follows another in the process flow (often derived).' },
    attributeStorage: { label: 'Attribute Storage', placeholder: '', tooltip: 'Are event/entity attributes stored as properties on the node, or as separate nodes connected by a relationship?' },
    attributeRelName: { label: 'Attribute Relationship Label', placeholder: 'e.g., HAS_ATTRIBUTE', tooltip: 'The relationship label connecting the main node to the attribute node.' },
    attributeNodeLabel: { label: 'Attribute Node Label', placeholder: 'e.g., EntityAttribute', tooltip: 'The label of the node that contains the attribute.' },
    attributeNameProperty: { label: 'Attribute Name Property', placeholder: 'e.g., name, attr_name', tooltip: 'The property on the attribute node that contains the attribute\'s name (e.g., "amount", "status").' },
    attributeValueProperty: { label: 'Attribute Value Property', placeholder: 'e.g., value', tooltip: 'The property on the attribute node that contains the value.' },
    dfTypeDistinction: { label: 'DF Type Distinction', placeholder: '', tooltip: 'Choose how the type of DF relationship is distinguished: by edge label (e.g., DF_Order) or by a property on the edge.' },
    dfTypePropertyName: { label: 'DF Relationship Type Property Name', placeholder: 'e.g., EntityType, df_type, type', tooltip: 'If you use a property on the DF relationship to indicate its type (e.g., "OrderToShipment"), specify its property name here.' },
    dfBaseRelName: { label: 'Event-Event DF Relation Name', placeholder: 'e.g., DF, DIRECTLY_FOLLOWS', tooltip: 'The relationship type connecting an event to the next event in the same case/trace.' }
};


interface TechnicalConfiguratorProps {
    currentConfig: GlobalProcessConfig;
    onConfigSave: (newConfig: GlobalProcessConfig) => void;
    onCancel?: () => void;
}

const TechnicalConfigurator: React.FC<TechnicalConfiguratorProps> = ({ currentConfig, onConfigSave, onCancel }) => {
    const [config, setConfig] = useState<GlobalProcessConfig>(currentConfig);
    const [currentStep, setCurrentStep] = useState(1);
    const { setAutocompleteData } = useGlobalConfig();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setConfig(currentConfig);
    }, [currentConfig]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const targetValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setConfig(prev => ({ ...prev, [name]: targetValue }));
    };

    const handleNext = async () => {
        setError(null);
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        } else {
            try {
                const [entityTypesRes, activityTypesRes] = await Promise.all([
                    fetch('http://localhost:8000/api/entity-types', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config }),
                    }),
                    fetch('http://localhost:8000/api/activity-types', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config }),
                    }),
                ]);

                if (!entityTypesRes.ok || !activityTypesRes.ok) {
                    let errorMsg = "An error occurred fetching data.";
                    if (!entityTypesRes.ok) {
                        const entityError = await entityTypesRes.json();
                        errorMsg += ` Entity types error: ${entityError.detail}.`;
                    }
                    if (!activityTypesRes.ok) {
                        const activityError = await activityTypesRes.json();
                        errorMsg += ` Activity types error: ${activityError.detail}.`;
                    }
                    throw new Error(errorMsg);
                }

                const entityTypesData = await entityTypesRes.json();
                const activityTypesData = await activityTypesRes.json();
                setAutocompleteData({
                    entityTypes: entityTypesData.types || [],
                    activityTypes: activityTypesData.types || [],
                });
                onConfigSave(config);
            } catch (error) {
                console.error("Failed to fetch autocomplete data:", error);
                setError(error instanceof Error ? error.message : "An unknown error occurred. Check the console and backend for details.");
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else if (onCancel) {
            onCancel();
        }
    };

    const activeStep = steps.find(s => s.id === currentStep);

    if (!activeStep) return <div>Error: Configuration step not found.</div>;

    const isLastStep = currentStep === steps.length;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <Card className="w-full max-h-[90vh] overflow-y-auto">
                    {error && (
                        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
                            <span className="font-medium">Error!</span> {error}
                        </div>
                    )}
                    {!onCancel && (
                        <div className="p-4 mb-4 text-sm text-blue-700 bg-blue-100 rounded-lg dark:bg-blue-200 dark:text-blue-800" role="alert">
                            <span className="font-medium">Welcome!</span> Please configure your process details to get started.
                        </div>
                    )}
                    <CardHeader>
                        <CardTitle>Technical Process Configuration</CardTitle>
                        <CardDescription>
                            Step {currentStep} of {steps.length}: {activeStep.title}
                        </CardDescription>
                        <Progress value={currentStep} max={steps.length} className="mt-2" />
                    </CardHeader>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{activeStep.description}</p>

                    <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                        <div className="space-y-6">
                            {activeStep.fields.map(fieldName => {
                                const details = fieldDetails[fieldName];

                                if (fieldName === 'attributeStorage') {
                                    return (
                                        <div key={fieldName}>
                                            <Label htmlFor={fieldName} className="flex items-center">
                                                {details.label}
                                                <Tooltip content={details.tooltip}><InfoIcon className="cursor-help" /></Tooltip>
                                            </Label>
                                            <select
                                                id={fieldName} name={fieldName}
                                                value={config.attributeStorage}
                                                onChange={handleChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            >
                                                <option value="property">As properties on the node</option>
                                                <option value="node">As separate nodes connected by a relationship</option>
                                            </select>
                                        </div>
                                    );
                                }

                                if (
                                    (fieldName === 'attributeRelName' || fieldName === 'attributeNodeLabel' ||
                                        fieldName === 'attributeNameProperty' || fieldName === 'attributeValueProperty') &&
                                    config.attributeStorage !== 'node'
                                ) {
                                    return null;
                                }

                                if (fieldName === 'dfTypeDistinction') {
                                    return (
                                        <div key={fieldName}>
                                            <Label htmlFor={fieldName} className="flex items-center">
                                                {details.label}
                                                <Tooltip content={details.tooltip}><InfoIcon className="cursor-help" /></Tooltip>
                                            </Label>
                                            <select
                                                id={fieldName} name={fieldName} value={config.dfTypeDistinction} onChange={handleChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            >
                                                <option value="label">DF edge label includes entity type (e.g., DF_Order)</option>
                                                <option value="property">DF edge has a property for type</option>
                                            </select>
                                        </div>
                                    );
                                }
                                if (fieldName === 'dfTypePropertyName' && config.dfTypeDistinction !== 'property') return null;

                                return (
                                    <div key={fieldName}>
                                        <Label htmlFor={fieldName} className="flex items-center">
                                            {details.label}
                                            <Tooltip content={details.tooltip}><InfoIcon className="cursor-help" /></Tooltip>
                                        </Label>
                                        <Input
                                            type="text" id={fieldName} name={fieldName}
                                            value={config[fieldName]?.toString() || ''} onChange={handleChange}
                                            placeholder={details.placeholder} required
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {isLastStep && (
                            <div className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Review Configuration</h3>
                                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    {Object.entries(config).map(([key, value]) => {
                                        const fieldConf = fieldDetails[key as keyof GlobalProcessConfig];
                                        if (!fieldConf) return null; // Skip fields not in details
                                        // Conditional rendering logic based on dependencies
                                        if (key === 'dfTypePropertyName' && config.dfTypeDistinction !== 'property') return null;
                                        if (['attributeRelName', 'attributeNodeLabel', 'attributeNameProperty', 'attributeValueProperty'].includes(key) && config.attributeStorage !== 'node') return null;
                                        return (
                                            <li key={key} className="flex justify-between">
                                                <span className="font-semibold">{fieldConf.label}:</span>
                                                <span className="text-right font-mono text-indigo-600 dark:text-indigo-400">{value.toString()}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        <div className="mt-8 flex justify-between items-center">
                            <Button
                                type="button" variant="outline" onClick={handleBack}
                                disabled={currentStep === 1 && !onCancel}
                            >
                                {currentStep === 1 ? (onCancel ? 'Cancel' : 'Start') : 'Back'}
                            </Button>
                            <Button type="submit">
                                {isLastStep ? 'Save & Continue' : 'Next'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default TechnicalConfigurator;
export { Label, Input, Button, Progress, Tooltip, InfoIcon };
