// Main Entry Point
// =================
// נקודת הכניסה הראשית של האפליקציה

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Hide loading screen after React is ready
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
};

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Create React root and render app
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide loading screen when React is mounted
hideLoadingScreen();

// Log app startup in development
if (import.meta.env.DEV) {
  console.log('⚛️ React App Started');
  console.log('🔧 Mode:', import.meta.env.MODE);
  console.log('📦 Version:', import.meta.env.VITE_APP_VERSION);
}
