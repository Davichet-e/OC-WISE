import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import 'reactflow/dist/style.css';
import './App.css';
import TechnicalConfigurator from './TechnicalConfiguration';
import { useGlobalConfig } from './GlobalConfig';
import Dashboard from './Dashboard';
import ProcessDefinitions from './ProcessDefinitions';
import { GlobalProcessConfig } from './config';

export interface CreatedNorm {
  norm_type: string;
  norm_id: string;
  description: string;
  weight?: number;
  enabled: boolean;
  execution_filters?: any[]; // Simplified for this context
  [key: string]: any; // Allow other properties
}

const App: React.FC = () => {
  const { config, setConfig, isConfigSet, setIsConfigSet } = useGlobalConfig();
  const navigate = useNavigate();
  const location = useLocation(); // 2. GET location to make cancel smarter

  // 3. UPDATE handleConfigSave to accept the return path
  const handleConfigSave = (newConfig: GlobalProcessConfig, returnTo?: string) => {
    setConfig(newConfig);
    setIsConfigSet(true);
    navigate(returnTo || '/definitions'); // Navigate back or to default
  };

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/definitions" element={<ProcessDefinitions />} />
      <Route
        path="/configure"
        element={
          <TechnicalConfigurator
            currentConfig={config}
            onConfigSave={handleConfigSave}
            // 4. UPDATE onCancel to use the location state for more flexible navigation
            onCancel={isConfigSet ? () => navigate(location.state?.from || '/definitions') : undefined}
          />
        }
      />
    </Routes>
  );
};

export default App;
