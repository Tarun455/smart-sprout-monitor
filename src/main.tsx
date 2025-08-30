import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add global error handlers to catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent the default browser behavior (logging to console)
    event.preventDefault();
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
