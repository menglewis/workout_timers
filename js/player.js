// Player view: runs a workout with the timer engine, spoken cues and a steps sheet.
import { getWorkout, getSettings } from './storage.js';
import { expand, formatTime, typeLabel } from './model.js';
import { Engine } from './engine.js';
import { attachCues } from './audio.js';
import { esc, icons, stepList } from './ui.js';

export function renderPlayer(root, [id], app) {
  const workout = getWorkout(id);
  if (!workout) {
    app.navigate('#/', { replace: true });
    return;
  }
  const steps = expand(workout);
  const settings = getSettings();
  const engine = new Engine(steps, { leadIn: settings.leadIn });
  const detachCues = attachCues(engine, app.sound, getSettings, workout);
  let leaving = false;

  root.className = 'player-view';
  root.innerHTML = `
    <div class="player t-prep" id="player">
      <header class="player-top">
        <button class="icon-btn" id="exit" aria-label="Exit workout">${icons.close}</button>
        <div class="player-title ellipsis">${esc(workout.name)}</div>
        <button class="icon-btn" id="open-steps" aria-label="Show all steps">${icons.list}</button>
      </header>

      <div class="player-main">
        <div class="player-meta" id="meta"></div>
        <div class="player-type" id="type"></div>
        <div class="player-step" id="step-name"></div>
        <div class="player-time" id="time">0:00</div>
        <div class="bar"><span id="step-bar"></span></div>
        <div class="player-notes" id="notes"></div>
      </div>

      <div class="player-next" id="next"></div>

      <div class="player-controls">
        <button class="ctl" id="prev" aria-label="Previous step">${icons.prev}</button>
        <button class="ctl ctl-main" id="toggle" aria-label="Start">${icons.play}</button>
        <button class="ctl" id="next-btn" aria-label="Next step">${icons.next}</button>
      </div>

      <div class="player-bottom">
        <button class="btn-text" id="restart">${icons.restart} Restart step</button>
        <span id="total"></span>
      </div>
      <div class="bar thin"><span id="total-bar"></span></div>

      <div class="player-done" id="done" hidden>
        <h2>Workout complete</h2>
        <p id="done-summary"></p>
        <button class="btn primary big" id="again">${icons.restart} Do it again</button>
        <button class="btn big" id="done-exit">Back to workouts</button>
      </div>
    </div>

    <div class="sheet" id="sheet" hidden>
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet-panel" role="dialog" aria-label="Workout steps">
        <div class="sheet-head">
          <h2>Steps</h2>
          <button class="icon-btn" data-close aria-label="Close">${icons.close}</button>
        </div>
        <div class="sheet-body" id="sheet-body"></div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const el = {
    player: $('#player'),
    meta: $('#meta'),
    type: $('#type'),
    name: $('#step-name'),
    time: $('#time'),
    stepBar: $('#step-bar'),
    notes: $('#notes'),
    next: $('#next'),
    toggle: $('#toggle'),
    total: $('#total'),
    totalBar: $('#total-bar'),
    done: $('#done'),
    doneSummary: $('#done-summary'),
    sheet: $('#sheet'),
    sheetBody: $('#sheet-body'),
  };
  const totalSecs = engine.getTotal();

  // ---- rendering ----

  function renderStep() {
    const s = engine.currentStep();
    const i = engine.index;
    el.player.className = `player t-${s.type}`;
    el.name.textContent = s.name;
    el.type.textContent = s.lead ? '' : typeLabel(s.type);
    el.notes.textContent = s.notes || '';

    const meta = [];
    if (s.lead) meta.push('Starting soon');
    else {
      if (s.blockName && workout.blocks.length > 1) meta.push(esc(s.blockName));
      if (s.totalRounds > 1) meta.push(`Round ${s.round}/${s.totalRounds}`);
      meta.push(`Step ${i + 1}/${steps.length}`);
    }
    el.meta.innerHTML = meta.join(' · ');

    const n = engine.nextStep();
    el.next.innerHTML = n
      ? `<span class="muted">Next</span> <span class="next-dot t-${n.type}"></span> ${esc(n.name)} · ${formatTime(n.duration)}`
      : `<span class="muted">Last step</span>`;

    if (!el.sheet.hidden) renderSheet();
  }

  function renderTick() {
    const s = engine.currentStep();
    const rem = engine.getRemainingMs();
    el.time.textContent = formatTime(Math.ceil(rem / 1000));
    const frac = s.duration ? 1 - rem / (s.duration * 1000) : 1;
    el.stepBar.style.width = `${Math.min(100, Math.max(0, frac * 100))}%`;
    const elapsed = engine.getElapsedTotal();
    el.total.textContent = `${formatTime(elapsed)} / ${formatTime(totalSecs)}`;
    el.totalBar.style.width = `${totalSecs ? Math.min(100, (elapsed / totalSecs) * 100) : 0}%`;
  }

  function renderState() {
    const st = engine.state;
    const running = st === 'running';
    el.toggle.innerHTML = running ? icons.pause : icons.play;
    el.toggle.setAttribute('aria-label', running ? 'Pause' : st === 'idle' ? 'Start' : 'Resume');
    el.player.classList.toggle('paused', st === 'paused');
    el.done.hidden = st !== 'finished';
    if (st === 'finished') {
      el.doneSummary.textContent = `${workout.name} · ${formatTime(totalSecs)} · ${steps.length} steps`;
    }
  }

  function renderSheet() {
    el.sheetBody.innerHTML = stepList(steps, { current: engine.index, interactive: true });
    el.sheetBody.querySelector('.current')?.scrollIntoView({ block: 'center' });
  }

  // ---- wake lock & media session ----

  let wakeLock = null;
  async function lockScreen() {
    if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } catch (e) {
      console.warn('Wake lock unavailable', e);
    }
  }
  function unlockScreen() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }
  function onVisibility() {
    if (document.visibilityState === 'visible' && (engine.state === 'running' || engine.state === 'paused')) {
      lockScreen();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: workout.name, artist: 'Workout Timer' });
      navigator.mediaSession.setActionHandler('play', () => engine.resume());
      navigator.mediaSession.setActionHandler('pause', () => engine.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => engine.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => engine.prev());
    } catch {
      /* not supported */
    }
  }

  // ---- engine events ----

  engine.addEventListener('stepstart', renderStep);
  engine.addEventListener('tick', renderTick);
  engine.addEventListener('statechange', () => {
    renderState();
    if (engine.state === 'running' || engine.state === 'paused') lockScreen();
    else unlockScreen();
  });

  // ---- controls ----

  function start() {
    app.sound.unlock();
    engine.start();
  }

  el.toggle.addEventListener('click', () => {
    app.sound.unlock();
    if (engine.state === 'idle') start();
    else engine.toggle();
  });
  $('#prev').addEventListener('click', () => engine.prev());
  $('#next-btn').addEventListener('click', () => engine.next());
  $('#restart').addEventListener('click', () => engine.restartStep());

  function exit() {
    leaving = true;
    app.navigate('#/workout/' + encodeURIComponent(workout.id));
  }
  $('#exit').addEventListener('click', () => {
    if (engine.state === 'running' || engine.state === 'paused') {
      const wasRunning = engine.state === 'running';
      if (wasRunning) engine.pause();
      if (!confirm('End this workout?')) {
        if (wasRunning) engine.resume();
        return;
      }
    }
    exit();
  });
  $('#done-exit').addEventListener('click', exit);
  $('#again').addEventListener('click', () => {
    app.sound.unlock();
    engine.restart();
  });

  $('#open-steps').addEventListener('click', () => {
    el.sheet.hidden = false;
    renderSheet();
  });
  el.sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      el.sheet.hidden = true;
      return;
    }
    const row = e.target.closest('[data-index]');
    if (row) {
      app.sound.unlock();
      if (engine.state === 'idle') engine.start();
      engine.jumpTo(Number(row.dataset.index));
      el.sheet.hidden = true;
    }
  });

  // Keyboard shortcuts (handy on desktop): space = play/pause, arrows = prev/next.
  function onKey(e) {
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      el.toggle.click();
    } else if (e.code === 'ArrowRight') engine.next();
    else if (e.code === 'ArrowLeft') engine.prev();
  }
  document.addEventListener('keydown', onKey);

  // ---- initial render ----

  renderStep();
  renderTick();
  renderState();
  if (app.autostart) {
    app.autostart = false;
    start();
  }

  return {
    beforeLeave() {
      if (leaving || engine.state === 'idle' || engine.state === 'finished') return true;
      const wasRunning = engine.state === 'running';
      if (wasRunning) engine.pause();
      const ok = confirm('End this workout?');
      if (!ok && wasRunning) engine.resume();
      return ok;
    },
    cleanup() {
      engine.stop();
      detachCues();
      app.sound.cancel();
      unlockScreen();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKey);
      if ('mediaSession' in navigator) {
        try {
          ['play', 'pause', 'nexttrack', 'previoustrack'].forEach((a) => navigator.mediaSession.setActionHandler(a, null));
          navigator.mediaSession.metadata = null;
        } catch {
          /* ignore */
        }
      }
    },
  };
}
