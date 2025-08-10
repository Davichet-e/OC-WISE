import React, { createContext, useState, useContext, ReactNode } from 'react';
import { GlobalProcessConfig, initialGlobalProcessConfig } from './config';

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
        } catch {
            console.error("Failed to parse config from localStorage");
            return initialGlobalProcessConfig;
        }
    });

    const [isConfigSet, setIsConfigSetState] = useState<boolean>(() => {
        try {
            return localStorage.getItem('isConfigSet') === 'true';
        } catch {
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
