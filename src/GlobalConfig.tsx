import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface GlobalProcessConfig {
    // Node related
    eventNodeLabel: string;
    entityNodeLabel: string;
    activityProperty: string;
    entityFilterProperty: string;
    timestampProperty: string;

    // Relationship related
    dfBaseRelName: string;
    corrRelName: string;
    dfEntityRelName: string;

    // Attribute Storage
    attributeStorage: 'property' | 'node';
    // Only if attributeStorage === 'node'
    attributeRelName?: string;
    attributeNodeLabel?: string;
    attributeNameProperty?: string;
    attributeValueProperty?: string;

    // How is the DF type distinguished?
    dfTypeDistinction: 'label' | 'property';

    // Property on DF relationship indicating type (optional, only if dfTypeDistinction === 'property')
    dfTypePropertyName?: string;
}

export const initialGlobalProcessConfig: GlobalProcessConfig = {
    eventNodeLabel: 'Event',
    entityNodeLabel: 'Entity',
    activityProperty: 'type',
    entityFilterProperty: 'type',
    timestampProperty: 'time',
    dfBaseRelName: 'DF',
    corrRelName: 'CORR',
    dfEntityRelName: 'DF_ENTITY',
    attributeStorage: 'property',
    attributeRelName: 'HAS_ATTRIBUTE',
    attributeNodeLabel: 'Attribute',
    attributeNameProperty: 'name',
    attributeValueProperty: 'value',
    dfTypeDistinction: 'label',
    dfTypePropertyName: undefined,
};

interface AutocompleteData {
    entityTypes: string[];
    activityTypes: string[];
}

interface GlobalConfigContextType {
    config: GlobalProcessConfig;
    setConfig: (config: GlobalProcessConfig) => void;
    isConfigSet: boolean;
    setIsConfigSet: (isSet: boolean) => void;
    autocompleteData: AutocompleteData;
    setAutocompleteData: (data: AutocompleteData) => void;
}

const GlobalConfigContext = createContext<GlobalConfigContextType | undefined>(undefined);

export const GlobalConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfigState] = useState<GlobalProcessConfig>(() => {
        try {
            const storedConfig = localStorage.getItem('globalProcessConfig');
            return storedConfig ? JSON.parse(storedConfig) : initialGlobalProcessConfig;
        } catch (error) {
            console.error("Failed to parse config from localStorage", error);
            return initialGlobalProcessConfig;
        }
    });

    const [isConfigSet, setIsConfigSetState] = useState<boolean>(() => {
        try {
            return localStorage.getItem('isConfigSet') === 'true';
        } catch (error) {
            return false;
        }
    });

    const [autocompleteData, setAutocompleteDataState] = useState<AutocompleteData>({ entityTypes: [], activityTypes: [] });

    const setConfig = (newConfig: GlobalProcessConfig) => {
        localStorage.setItem('globalProcessConfig', JSON.stringify(newConfig));
        setConfigState(newConfig);
    };

    const setIsConfigSet = (isSet: boolean) => {
        localStorage.setItem('isConfigSet', isSet ? 'true' : 'false');
        setIsConfigSetState(isSet);
    };

    const setAutocompleteData = (data: AutocompleteData) => {
        setAutocompleteDataState(data);
    };

    return (
        <GlobalConfigContext.Provider value={{ config, setConfig, isConfigSet, setIsConfigSet, autocompleteData, setAutocompleteData }}>
            {children}
        </GlobalConfigContext.Provider>
    );
};

export const useGlobalConfig = () => {
    const context = useContext(GlobalConfigContext);
    if (context === undefined) {
        throw new Error('useGlobalConfig must be used within a GlobalConfigProvider');
    }
    return context;
};
