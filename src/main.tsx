import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { initDatabase, isStorageAvailable } from './db/database';
import './index.css';
import { registerServiceWorker } from './lib/pwa';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

function bootstrap(root: HTMLElement): void {
  void initDatabase()
    .catch(() => {
      // Storage problems are surfaced by the Settings page;
      // the app shell still loads so the user sees a friendly message.
    })
    .finally(() => {
      createRoot(root).render(
        <StrictMode>
          <HashRouter>
            <ToastProvider>
              <App />
            </ToastProvider>
          </HashRouter>
        </StrictMode>,
      );
    });
}

bootstrap(container);

registerServiceWorker();

// Warm the availability check once; consumed by the Settings page.
void isStorageAvailable();
