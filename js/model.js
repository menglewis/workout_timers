// Workout data model helpers.
//
// Workout = { id, name, description, builtIn?, blocks: [Block] }
// Block   = { name?, rounds, restBetweenRounds, steps: [Step] }
// Step    = { name, type: 'work'|'rest'|'warmup'|'cooldown', duration (sec), notes? }

export const STEP_TYPES = [
  { value: 'work', label: 'Work' },
  { value: 'rest', label: 'Rest' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Cool-down' },
];

export function typeLabel(type) {
  return (STEP_TYPES.find((t) => t.value === type) || STEP_TYPES[0]).label;
}

export function newId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function newStep(overrides = {}) {
  return { name: '', type: 'work', duration: 30, notes: '', ...overrides };
}

export function newBlock(overrides = {}) {
  return { name: '', rounds: 1, restBetweenRounds: 0, steps: [newStep()], ...overrides };
}

export function newWorkout() {
  return { id: newId(), name: '', description: '', blocks: [newBlock()] };
}

/** Deep copy (workouts are plain JSON). */
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Flatten blocks x rounds into a linear timeline of steps.
 * Adds an automatic rest between rounds (not after the last round).
 */
export function expand(workout) {
  const out = [];
  (workout.blocks || []).forEach((block, blockIdx) => {
    const rounds = Math.max(1, block.rounds | 0);
    for (let round = 1; round <= rounds; round++) {
      block.steps.forEach((step) => {
        out.push({
          name: step.name || 'Untitled step',
          type: step.type || 'work',
          duration: Math.max(1, step.duration | 0),
          notes: step.notes || '',
          blockIdx,
          blockName: block.name || '',
          round,
          totalRounds: rounds,
          auto: false,
        });
      });
      if (round < rounds && (block.restBetweenRounds | 0) > 0) {
        out.push({
          name: 'Rest',
          type: 'rest',
          duration: block.restBetweenRounds | 0,
          notes: '',
          blockIdx,
          blockName: block.name || '',
          round,
          totalRounds: rounds,
          auto: true,
        });
      }
    }
  });
  return out;
}

export function totalDuration(workout) {
  return expand(workout).reduce((sum, s) => sum + s.duration, 0);
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Human-friendly duration for speech, e.g. "1 minute 30 seconds". */
export function spokenDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (r || !m) parts.push(`${r} second${r === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Returns an array of error strings (empty when valid). */
export function validate(workout) {
  const errors = [];
  if (!workout.name || !workout.name.trim()) errors.push('Give the workout a name.');
  if (!workout.blocks || workout.blocks.length === 0) errors.push('Add at least one block.');
  (workout.blocks || []).forEach((b, bi) => {
    const label = `Block ${bi + 1}`;
    if (!b.steps || b.steps.length === 0) errors.push(`${label} has no steps.`);
    if (!(b.rounds >= 1)) errors.push(`${label}: rounds must be at least 1.`);
    if (!(b.restBetweenRounds >= 0)) errors.push(`${label}: rest between rounds can't be negative.`);
    (b.steps || []).forEach((s, si) => {
      if (!s.name || !s.name.trim()) errors.push(`${label}, step ${si + 1}: needs a name.`);
      if (!(s.duration >= 1)) errors.push(`${label}, step ${si + 1}: duration must be at least 1 second.`);
    });
  });
  return errors;
}

/** Light sanitising for imported JSON. Returns a workout or null. */
export function normalizeWorkout(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocks)) return null;
  const types = STEP_TYPES.map((t) => t.value);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: String(raw.name || 'Imported workout'),
    description: String(raw.description || ''),
    blocks: raw.blocks
      .filter((b) => b && Array.isArray(b.steps))
      .map((b) => ({
        name: String(b.name || ''),
        rounds: Math.max(1, parseInt(b.rounds, 10) || 1),
        restBetweenRounds: Math.max(0, parseInt(b.restBetweenRounds, 10) || 0),
        steps: b.steps
          .filter((s) => s && typeof s === 'object')
          .map((s) => ({
            name: String(s.name || 'Step'),
            type: types.includes(s.type) ? s.type : 'work',
            duration: Math.max(1, parseInt(s.duration, 10) || 30),
            notes: String(s.notes || ''),
          })),
      }))
      .filter((b) => b.steps.length > 0),
  };
}
