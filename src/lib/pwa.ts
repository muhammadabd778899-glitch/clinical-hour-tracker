/** PWA helpers: offline detection and service-worker registration. */
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

let online = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<(online: boolean) => void>();

export function isOnline(): boolean {
  return online;
}

export function subscribeOnline(callback: (online: boolean) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('offline', () => {
    online = false;
    listeners.forEach((l) => l(false));
  });
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  registerSW({ immediate: true });
}
