import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import TechnicalConfigurator from './TechnicalConfiguration';
import { useGlobalConfig } from './GlobalConfig';
import GraphNormCreatorInternal from './GraphNormCreator';
import Dashboard from './Dashboard';

import { Filter } from './PropertyFilter';
import { GlobalProcessConfig } from './config';

export interface CreatedNorm {
  norm_type: string;
  norm_id: string;
  description: string;
  weight?: number;
  enabled: boolean;
  execution_filters?: Filter[];
}

const App: React.FC = () => {
  const { config, setConfig, isConfigSet, setIsConfigSet } = useGlobalConfig();
  const [createdNorms, setCreatedNorms] = useState<CreatedNorm[]>([]);
  const navigate = useNavigate();

  const handleConfigSave = (newConfig: GlobalProcessConfig) => {
    setConfig(newConfig);
    setIsConfigSet(true);
    navigate('/norms-editor');
  };

  const handleBackToTechConfig = () => {
    setIsConfigSet(false);
    navigate('/configure');
  };

  const handleDeleteNorm = (normId: string) => {
    setCreatedNorms(prev => prev.filter(n => n.norm_id !== normId));
  };

  const handleToggleNorm = (normId: string) => {
    setCreatedNorms(prev => prev.map(n => n.norm_id === normId ? { ...n, enabled: !n.enabled } : n));
  };

  return (
    <Routes>
      <Route path="/" element={<Dashboard createdNorms={createdNorms} config={config} />} />
      <Route path="/configure" element={
        <TechnicalConfigurator
          currentConfig={config}
          onConfigSave={handleConfigSave}
          onCancel={isConfigSet ? () => navigate('/norms-editor') : undefined}
        />
      } />
      <Route path="/norms-editor" element={
        isConfigSet ? (
          <ReactFlowProvider>
            <GraphNormCreatorInternal
              globalProcessConfig={config}
              onBackToTechConfig={handleBackToTechConfig}
              createdNorms={createdNorms}
              setCreatedNorms={setCreatedNorms}
              onDeleteNorm={handleDeleteNorm}
              onToggleNorm={handleToggleNorm}
            />
          </ReactFlowProvider>
        ) : (
          <TechnicalConfigurator
            currentConfig={config}
            onConfigSave={handleConfigSave}
          />
        )
      } />
    </Routes>
  );
};

export default App;