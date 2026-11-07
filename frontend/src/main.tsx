import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { API_BASE_URL } from './lib/constants'

// Pre-warm the backend instantly whenever ANY user opens the webapp
if (typeof window !== 'undefined') {
  const pingBackend = () => {
    fetch(`${API_BASE_URL}/health`, { mode: 'cors' }).catch(() => {});
  };
  // Fire immediately on page load
  pingBackend();
  // Keep alive every 4 minutes while the app is active in the browser
  setInterval(pingBackend, 4 * 60 * 1000);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
