// Small shared UI helpers.
import { formatTime, typeLabel } from './model.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const svg = (path, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${path}</svg>`;

export const icons = {
  play: svg('<path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'),
  next: svg('<path d="M5 6.2v11.6a1 1 0 0 0 1.55.83L15 12.83V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v4.17L6.55 5.37A1 1 0 0 0 5 6.2z"/>'),
  prev: svg('<path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9 12.83V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v4.17l8.45-5.8A1 1 0 0 1 19 6.2z"/>'),
  restart: svg('<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>'),
  list: svg('<path d="M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z"/>'),
  close: svg('<path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"/>'),
  back: svg('<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>'),
  gear: svg('<path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54a7 7 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>'),
  plus: svg('<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>'),
  up: svg('<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>', 20),
  down: svg('<path d="M12 16l6-6-1.41-1.41L12 13.17 7.41 8.59 6 10z"/>', 20),
  copy: svg('<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/>', 20),
  trash: svg('<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>', 20),
  edit: svg('<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>', 20),
  download: svg('<path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>', 20),
};

/**
 * Render a flat timeline as a list grouped by block/round.
 * Each step row has data-index so callers can attach click handlers.
 */
export function stepList(steps, { current = null, interactive = false } = {}) {
  let html = '<ol class="step-list">';
  steps.forEach((s, i) => {
    const prev = steps[i - 1];
    const newBlock = !prev || prev.blockIdx !== s.blockIdx;
    const newRound = newBlock || prev.round !== s.round;
    if (newRound && (s.blockName || s.totalRounds > 1)) {
      const parts = [];
      if (s.blockName) parts.push(esc(s.blockName));
      if (s.totalRounds > 1) parts.push(`Round ${s.round} of ${s.totalRounds}`);
      html += `<li class="step-group">${parts.join(' · ')}</li>`;
    }
    const tag = interactive ? 'button' : 'div';
    const cls = ['step-row', `t-${s.type}`, i === current ? 'current' : '', current !== null && i < current ? 'done' : '']
      .filter(Boolean)
      .join(' ');
    html += `<li><${tag} class="${cls}" data-index="${i}"${interactive ? ' type="button"' : ''}>
      <span class="step-num">${i + 1}</span>
      <span class="step-main"><span class="step-name">${esc(s.name)}</span>
        <span class="step-type">${typeLabel(s.type)}${s.notes ? ' · ' + esc(s.notes) : ''}</span></span>
      <span class="step-dur">${formatTime(s.duration)}</span>
    </${tag}></li>`;
  });
  html += '</ol>';
  return html;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
