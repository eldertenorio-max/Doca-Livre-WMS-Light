import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { applyTheme, resolveAppTheme } from './lib/appTheme'
import { isSupabaseConfigured } from './lib/supabaseClient'
import './index.css'
import App from './App.tsx'

applyTheme(resolveAppTheme(false, isSupabaseConfigured()))

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
