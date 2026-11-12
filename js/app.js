// App entry: hash router, shared services, service worker registration.
import { getSettings, requestPersistence } from './storage.js';
import { Sound } from './audio.js';
import { renderLibrary, renderPreview } from './library.js';
import { renderPlayer } from './player.js';
import { renderEditor } from './editor.js';
import { renderSettings } from './settings.js';

let view = document.getElementById('view');

/** Shared services passed to every view. */
export const app = {
  sound: new Sound(getSettings),
  autostart: false, // set by the preview's Start button so the player starts right away
  installPrompt: null,
  navigate(hash, { replace = false } = {}) {
    if (replace) {
      history.replaceState(null, '', hash);
      route();
    } else {
      location.hash = hash;
    }
  },
};

const routes = [
  [/^#?\/?$/, () => renderLibrary],
  [/^#\/workout\/([^/?]+)$/, () => renderPreview],
  [/^#\/play\/([^/?]+)$/, () => renderPlayer],
  [/^#\/edit\/([^/?]+)(?:\?from=([^/&]+))?$/, () => renderEditor],
  [/^#\/settings$/, () => renderSettings],
];

let current = null; // { cleanup, beforeLeave }
let currentHash = null;
let routeId = 0;

function route() {
  const hash = location.hash || '#/';
  if (current && hash === currentHash) return;
  if (current && current.beforeLeave && hash !== currentHash && !current.beforeLeave()) {
    // Stay put: restore the previous hash (pushState doesn't fire hashchange).
    history.pushState(null, '', currentHash);
    return;
  }
  if (current && current.cleanup) current.cleanup();
  current = null;

  for (const [re, getRender] of routes) {
    const m = hash.match(re);
    if (m) {
      const params = m.slice(1).map((p) => (p ? decodeURIComponent(p) : p));
      // Fresh container per view, so listeners a view put on it can't leak into the next one.
      const fresh = document.createElement('main');
      fresh.id = 'view';
      fresh.setAttribute('aria-live', 'polite');
      view.replaceWith(fresh);
      view = fresh;
      window.scrollTo(0, 0);
      currentHash = hash;
      const id = ++routeId;
      const result = getRender()(view, params, app);
      // A view may redirect while rendering; keep the newer route's handlers in that case.
      if (id === routeId) current = result || {};
      return;
    }
  }
  app.navigate('#/', { replace: true });
}

window.addEventListener('hashchange', route);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  app.installPrompt = e;
  document.dispatchEvent(new Event('installable'));
});

requestPersistence();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
