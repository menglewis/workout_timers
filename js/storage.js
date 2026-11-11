// localStorage persistence for custom workouts and settings.
import { BUILTINS } from './builtins.js';
import { normalizeWorkout, newId } from './model.js';

const WORKOUTS_KEY = 'wt.workouts.v1';
const SETTINGS_KEY = 'wt.settings.v1';

export const DEFAULT_SETTINGS = {
  voice: true,
  beeps: true,
  halfway: true,
  tenSeconds: true,
  readNotes: false,
  leadIn: 5,
  voiceURI: '',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Could not save', key, e);
    return false;
  }
}

/** Ask the browser not to evict our storage (best effort). */
export function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch {
    /* ignore */
  }
}

export function getCustomWorkouts() {
  const list = readJSON(WORKOUTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function getAllWorkouts() {
  return { builtIns: BUILTINS, custom: getCustomWorkouts() };
}

export function getWorkout(id) {
  return BUILTINS.find((w) => w.id === id) || getCustomWorkouts().find((w) => w.id === id) || null;
}

export function saveWorkout(workout) {
  const list = getCustomWorkouts();
  const copy = { ...workout };
  delete copy.builtIn;
  const i = list.findIndex((w) => w.id === copy.id);
  if (i >= 0) list[i] = copy;
  else list.push(copy);
  return writeJSON(WORKOUTS_KEY, list);
}

export function deleteWorkout(id) {
  return writeJSON(
    WORKOUTS_KEY,
    getCustomWorkouts().filter((w) => w.id !== id)
  );
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  return writeJSON(SETTINGS_KEY, settings);
}

export function exportWorkoutsJSON() {
  return JSON.stringify({ app: 'workout-timer', version: 1, workouts: getCustomWorkouts() }, null, 2);
}

/**
 * Import workouts from a JSON string. Workouts whose id already exists get a new id
 * so nothing is overwritten. Returns the number imported.
 */
export function importWorkoutsJSON(text) {
  const data = JSON.parse(text);
  const incoming = Array.isArray(data) ? data : data && data.workouts;
  if (!Array.isArray(incoming)) throw new Error('No workouts found in that file.');
  const list = getCustomWorkouts();
  const ids = new Set([...list.map((w) => w.id), ...BUILTINS.map((w) => w.id)]);
  let count = 0;
  incoming.forEach((raw) => {
    const wk = normalizeWorkout(raw);
    if (!wk || wk.blocks.length === 0) return;
    if (ids.has(wk.id)) wk.id = newId();
    ids.add(wk.id);
    list.push(wk);
    count++;
  });
  writeJSON(WORKOUTS_KEY, list);
  return count;
}
