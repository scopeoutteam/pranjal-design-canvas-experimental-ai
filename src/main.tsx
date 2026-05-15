import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PreviewPage from './PreviewPage'
import './index.css'

const isPreview = window.location.pathname === '/preview'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPreview ? <PreviewPage /> : <App />}</StrictMode>,
)
