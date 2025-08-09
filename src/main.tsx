import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { GlobalConfigProvider } from './GlobalConfig.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalConfigProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GlobalConfigProvider>
  </StrictMode>,
);
