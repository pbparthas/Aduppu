import React from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/saira-condensed/400.css';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/caveat/700.css';

import { registerSW } from 'virtual:pwa-register';

import App from './App.jsx';
import { getMode, applyMode } from './lib/theme.js';
import './styles.css';

// Apply the saved appearance mode before first paint so a dark-mode user
// never sees a paper flash, and the choice actually persists across reloads.
applyMode(getMode());

// Offline app shell. autoUpdate installs a new build and reloads on its own;
// re-check hourly so long-lived sessions don't go stale.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) { if (reg) setInterval(() => reg.update(), 60 * 60 * 1000); },
});

// Ask the browser to keep our IndexedDB from being evicted.
// Installed PWAs are usually granted this silently.
(async () => {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* unsupported or blocked */ }
})();

// If a lazy chunk 404s because a deploy rotated the hashes mid-session, reload
// once to pick up the new chunk map instead of crashing.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('aduppu:reloadedForChunk')) {
    sessionStorage.setItem('aduppu:reloadedForChunk', '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(<App />);
