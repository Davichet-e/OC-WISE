import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalConfigProvider } from './GlobalConfig.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalConfigProvider>
      <App />
    </GlobalConfigProvider>
  </StrictMode>,
)
