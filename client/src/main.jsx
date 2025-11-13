import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ColorModeProvider } from './ColorModeContext.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ColorModeProvider>
  </StrictMode>,
)
