// Library (list of workouts) and workout preview views.
import { getAllWorkouts, getWorkout, deleteWorkout } from './storage.js';
import { expand, totalDuration, formatTime } from './model.js';
import { esc, icons, stepList, toast } from './ui.js';

function card(w) {
  const steps = expand(w);
  const types = [...new Set(steps.map((s) => s.type))];
  return `<a class="card" href="#/workout/${encodeURIComponent(w.id)}">
    <div class="card-stripe">${types.map((t) => `<span class="t-${t}"></span>`).join('')}</div>
    <div class="card-body">
      <h3>${esc(w.name)}</h3>
      ${w.description ? `<p>${esc(w.description)}</p>` : ''}
      <div class="card-meta">${formatTime(totalDuration(w))} · ${steps.length} steps</div>
    </div>
  </a>`;
}

export function renderLibrary(root, _params, app) {
  const { builtIns, custom } = getAllWorkouts();
  root.innerHTML = `
    <header class="topbar">
      <h1>Workouts</h1>
      <div class="topbar-actions">
        <button class="btn-text" id="install" hidden>Install</button>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${icons.gear}</a>
      </div>
    </header>
    <section class="section">
      <div class="section-head">
        <h2>My workouts</h2>
        <a class="btn small" href="#/edit/new">${icons.plus} New</a>
      </div>
      ${
        custom.length
          ? `<div class="cards">${custom.map(card).join('')}</div>`
          : `<a class="empty" href="#/edit/new">No custom workouts yet. Tap to build your own, or duplicate a built-in one below.</a>`
      }
    </section>
    <section class="section">
      <div class="section-head"><h2>Built-in</h2></div>
      <div class="cards">${builtIns.map(card).join('')}</div>
    </section>`;

  const installBtn = root.querySelector('#install');
  const showInstall = () => (installBtn.hidden = !app.installPrompt);
  showInstall();
  document.addEventListener('installable', showInstall);
  installBtn.addEventListener('click', async () => {
    if (!app.installPrompt) return;
    app.installPrompt.prompt();
    await app.installPrompt.userChoice;
    app.installPrompt = null;
    showInstall();
  });

  return { cleanup: () => document.removeEventListener('installable', showInstall) };
}

export function renderPreview(root, [id], app) {
  const w = getWorkout(id);
  if (!w) {
    app.navigate('#/', { replace: true });
    return;
  }
  const steps = expand(w);
  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a>
      <h1 class="ellipsis">${esc(w.name)}</h1>
      <span class="icon-btn-spacer"></span>
    </header>
    <section class="section preview">
      ${w.description ? `<p class="muted">${esc(w.description)}</p>` : ''}
      <div class="preview-stats">
        <div><strong>${formatTime(totalDuration(w))}</strong><span>total</span></div>
        <div><strong>${steps.length}</strong><span>steps</span></div>
        <div><strong>${w.blocks.length}</strong><span>${w.blocks.length === 1 ? 'block' : 'blocks'}</span></div>
      </div>
      <button class="btn primary big" id="start">${icons.play} Start workout</button>
      <div class="row-actions">
        ${w.builtIn ? '' : `<a class="btn" href="#/edit/${encodeURIComponent(w.id)}">${icons.edit} Edit</a>`}
        <a class="btn" href="#/edit/new?from=${encodeURIComponent(w.id)}">${icons.copy} Duplicate</a>
        ${w.builtIn ? '' : `<button class="btn danger" id="delete">${icons.trash} Delete</button>`}
      </div>
      <h2 class="list-title">Steps</h2>
      ${stepList(steps)}
    </section>`;

  root.querySelector('#start').addEventListener('click', () => {
    app.sound.unlock(); // inside the tap, so Android allows audio
    app.autostart = true;
    app.navigate(`#/play/${encodeURIComponent(w.id)}`);
  });
  root.querySelector('#delete')?.addEventListener('click', () => {
    if (!confirm(`Delete "${w.name}"? This can't be undone.`)) return;
    deleteWorkout(w.id);
    toast('Workout deleted');
    app.navigate('#/', { replace: true });
  });
}
