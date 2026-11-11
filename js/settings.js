// Settings view: audio cue options, lead-in, voice, backup export/import.
import { getSettings, saveSettings, exportWorkoutsJSON, importWorkoutsJSON, getCustomWorkouts } from './storage.js';
import { getVoices } from './audio.js';
import { esc, icons, toast } from './ui.js';

const TOGGLES = [
  ['voice', 'Voice cues', 'Speak step names and the 3-2-1 countdown'],
  ['beeps', 'Beeps', 'Beep on the countdown and when a step changes'],
  ['halfway', '"Halfway" call', 'For steps of 20 seconds or more'],
  ['tenSeconds', '"10 seconds" call', 'For steps of 30 seconds or more'],
  ['readNotes', 'Read notes aloud', 'Speak each exercise\'s notes when it starts'],
];

export function renderSettings(root, _params, app) {
  const s = getSettings();

  function voiceOptions() {
    const voices = getVoices();
    const opts = [`<option value="">Automatic</option>`];
    voices.forEach((v) => {
      opts.push(
        `<option value="${esc(v.voiceURI)}"${v.voiceURI === s.voiceURI ? ' selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`
      );
    });
    return opts.join('');
  }

  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a>
      <h1>Settings</h1>
    </header>
    <section class="section">
      ${TOGGLES.map(
        ([key, label, help]) => `<label class="setting">
          <span>${label}<small>${help}</small></span>
          <input type="checkbox" data-key="${key}"${s[key] ? ' checked' : ''} />
        </label>`
      ).join('')}
      <label class="setting">
        <span>Get-ready countdown<small>Time before the first step</small></span>
        <select data-key="leadIn">
          ${[0, 3, 5, 10, 15].map((n) => `<option value="${n}"${n === s.leadIn ? ' selected' : ''}>${n ? n + ' s' : 'Off'}</option>`).join('')}
        </select>
      </label>
      <label class="setting">
        <span>Voice</span>
        <select data-key="voiceURI" id="voice-select">${voiceOptions()}</select>
      </label>
      <div class="settings-actions">
        <button class="btn" id="test">Test sound</button>
      </div>
    </section>

    <section class="section">
      <div class="section-head" style="margin-top:20px"><h2>Backup</h2></div>
      <p class="muted" style="margin-top:0;line-height:1.4">Your workouts are saved on this device only. Export a backup file to keep them safe or move them to another phone.</p>
      <div class="settings-actions">
        <button class="btn" id="export">${icons.download} Export my workouts</button>
        <button class="btn" id="import">Import workouts</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>
    </section>

    <p class="about">Tip: the screen stays on during a workout so the timer and voice keep running. If your phone locks or you switch apps, Android may pause the audio until you come back.</p>`;

  root.addEventListener('change', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    if (e.target.type === 'checkbox') s[key] = e.target.checked;
    else if (key === 'leadIn') s[key] = Number(e.target.value);
    else s[key] = e.target.value;
    saveSettings(s);
  });

  root.querySelector('#test').addEventListener('click', () => app.sound.test());

  // Voices load asynchronously on some browsers.
  const refreshVoices = () => {
    const sel = root.querySelector('#voice-select');
    if (sel) sel.innerHTML = voiceOptions();
  };
  window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices);

  root.querySelector('#export').addEventListener('click', () => {
    if (!getCustomWorkouts().length) {
      toast('No custom workouts to export yet.');
      return;
    }
    const blob = new Blob([exportWorkoutsJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const fileInput = root.querySelector('#import-file');
  root.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const n = importWorkoutsJSON(await file.text());
      toast(n ? `Imported ${n} workout${n === 1 ? '' : 's'}` : 'No workouts found in that file.');
    } catch (err) {
      toast('That file could not be read as a workout backup.');
      console.error(err);
    }
    fileInput.value = '';
  });

  return {
    cleanup: () => window.speechSynthesis?.removeEventListener?.('voiceschanged', refreshVoices),
  };
}
