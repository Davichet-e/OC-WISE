import React, { useState, useEffect } from 'react';
import { GlobalProcessConfig } from './GlobalConfig';
// Removed import for GlobalProcessConfig as it's defined above in the same "file"

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
            variantStyle = "bg-black-200 border border-input text-white hover:bg-accent hover:text-accent-foreground";
            break;
        case 'secondary':
            variantStyle = "bg-black-200 dark:bg-black-700 text-white dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600";
            break;
        default: // default
            variantStyle = "bg-black-600 text-white hover:bg-black-700";
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
        fields: ['aggregateByAttributeNodes', 'attributeRelLabel', 'attributeNodeLabel', 'attributeNameProperty', 'attributeValueProperty'],
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
    aggregateByAttributeNodes: { label: 'Attribute Storage', placeholder: '', tooltip: 'Are event/entity attributes stored as properties on the node, or as separate nodes connected by a relationship?' },
    attributeRelLabel: { label: 'Attribute Relationship Label', placeholder: 'e.g., HAS_ATTRIBUTE', tooltip: 'The relationship label connecting the main node to the attribute node.' },
    attributeNodeLabel: { label: 'Attribute Node Label', placeholder: 'e.g., EntityAttribute', tooltip: 'The label of the node that contains the attribute.' },
    attributeNameProperty: { label: 'Attribute Name Property', placeholder: 'e.g., name, attr_name', tooltip: 'The property on the attribute node that contains the attribute\'s name (e.g., "amount", "status").' },
    attributeValueProperty: { label: 'Attribute Value Property', placeholder: 'e.g., value', tooltip: 'The property on the attribute node that contains the value.' },
    dfTypeDistinction: { label: 'DF Type Distinction', placeholder: '', tooltip: 'Choose how the type of DF relationship is distinguished: by edge label (e.g., DF_Order) or by a property on the edge.' },
    dfTypePropertyName: { label: 'DF Relationship Type Property Name', placeholder: 'e.g., EntityType, df_type, type', tooltip: 'If you use a property on the DF relationship to indicate its type (e.g., "OrderToShipment"), specify its property name here.' },
    dfBaseRelName: { label: 'Event-Event DF Relation Name', placeholder: 'e.g., DF, DIRECTLY_FOLLOWS', tooltip: 'The relationship type connecting an event to the next event in the same case/trace.' },
};


interface TechnicalConfiguratorProps {
    currentConfig: GlobalProcessConfig;
    onConfigSave: (newConfig: GlobalProcessConfig) => void;
    onCancel?: () => void; // Optional: if this can be part of a larger flow
}

const TechnicalConfigurator: React.FC<TechnicalConfiguratorProps> = ({ currentConfig, onConfigSave, onCancel }) => {
    const [config, setConfig] = useState<GlobalProcessConfig>(currentConfig);
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        setConfig(currentConfig);
    }, [currentConfig]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value as string }));
    };

    const handleNext = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        } else {
            // This is the "Save" action on the last step
            onConfigSave(config);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else if (onCancel) {
            onCancel(); // If on first step and back is clicked, call onCancel
        }
    };

    const activeStep = steps.find(s => s.id === currentStep);

    if (!activeStep) return <div>Error: Configuration step not found.</div>;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <Card className="w-full max-h-[90vh] overflow-y-auto">
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
                                // AGGREGATE BY ATTRIBUTE NODES LOGIC
                                if (fieldName === 'aggregateByAttributeNodes') {
                                    const details = fieldDetails[fieldName];
                                    return (
                                        <div key={fieldName}>
                                            <Label htmlFor={fieldName} className="flex items-center">
                                                {details.label}
                                                <Tooltip content={details.tooltip}>
                                                    <InfoIcon className="cursor-help" />
                                                </Tooltip>
                                            </Label>
                                            <select
                                                id={fieldName}
                                                name={fieldName}
                                                value={config.aggregateByAttributeNodes}
                                                onChange={handleChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            >
                                                <option value="property">As properties on the node</option>
                                                <option value="node">As separate nodes connected by a relationship</option>
                                            </select>
                                        </div>
                                    );
                                }
                                // Only show the 3 extra fields if 'node' is selected
                                if (
                                    (fieldName === 'attributeRelLabel' ||
                                        fieldName === 'attributeNodeLabel' ||
                                        fieldName === 'attributeNameProperty' ||
                                        fieldName === 'attributeValueProperty') &&
                                    config.aggregateByAttributeNodes !== 'node'
                                ) {
                                    return null;
                                }
                                // DF TYPE DISTINCTION LOGIC
                                if (fieldName === 'dfTypeDistinction') {
                                    const details = fieldDetails[fieldName];
                                    return (
                                        <div key={fieldName}>
                                            <Label htmlFor={fieldName} className="flex items-center">
                                                {details.label}
                                                <Tooltip content={details.tooltip}>
                                                    <InfoIcon className="cursor-help" />
                                                </Tooltip>
                                            </Label>
                                            <select
                                                id={fieldName}
                                                name={fieldName}
                                                value={config.dfTypeDistinction}
                                                onChange={handleChange}
                                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            >
                                                <option value="label">DF edge label includes entity type (e.g., DF_Order)</option>
                                                <option value="property">DF edge has a property for type</option>
                                            </select>
                                        </div>
                                    );
                                }
                                if (fieldName === 'dfTypePropertyName' && config.dfTypeDistinction !== 'property') {
                                    return null; // Only show if 'property' is selected
                                }

                                // Default input
                                const details = fieldDetails[fieldName];
                                return (
                                    <div key={fieldName}>
                                        <Label htmlFor={fieldName} className="flex items-center">
                                            {fieldName === 'dfBaseRelName' && config.dfTypeDistinction !== 'property' ? 'Prefix for ' + details.label : details.label}
                                            <Tooltip content={details.tooltip}>
                                                <InfoIcon className="cursor-help" />
                                            </Tooltip>
                                        </Label>
                                        <Input
                                            type="text"
                                            id={fieldName}
                                            name={fieldName}
                                            value={config[fieldName] || ''}
                                            onChange={handleChange}
                                            placeholder={details.placeholder}
                                            required={fieldName !== 'dfTypePropertyName'}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {currentStep === steps.length && (
                            <div className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-850">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Review Configuration</h3>
                                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    {Object.entries(config).map(([key, value]) => {
                                        const detail = fieldDetails[key as keyof GlobalProcessConfig];
                                        if (key === 'dfTypePropertyName' && config.dfTypeDistinction !== 'property') return null;
                                        return (
                                            <li key={key}>
                                                <span className="font-semibold">{detail?.label || key}:</span> {value}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        <div className="mt-8 flex justify-between items-center">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                                disabled={currentStep === 1 && !onCancel}
                            >
                                {currentStep === 1 && !onCancel ? 'Start' : 'Back'}
                            </Button>
                            <Button type="submit">
                                {currentStep === steps.length ? 'Save Configuration' : 'Next'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default TechnicalConfigurator; // This line is removed as TechnicalConfigurator is used in App.tsx in the same "file"
export { Label, Input, Button, Progress, Tooltip, InfoIcon }; // Exporting the helper components for potential reuse