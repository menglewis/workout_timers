// Audio: spoken cues (Web Speech API) and beeps (Web Audio API).
import { spokenDuration } from './model.js';

let ctx = null;
let cachedVoices = [];

function synth() {
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function loadVoices() {
  const s = synth();
  if (!s) return [];
  cachedVoices = s.getVoices();
  return cachedVoices;
}

if (synth()) {
  loadVoices();
  synth().addEventListener?.('voiceschanged', loadVoices);
}

export function getVoices() {
  return cachedVoices.length ? cachedVoices : loadVoices();
}

function pickVoice(voiceURI) {
  const voices = getVoices();
  if (!voices.length) return null;
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  const lang = (navigator.language || 'en').toLowerCase();
  const en = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  return (
    en.find((v) => v.localService && v.lang.toLowerCase() === lang) ||
    en.find((v) => v.localService) ||
    en.find((v) => v.default) ||
    en[0] ||
    null
  );
}

export class Sound {
  constructor(getSettings) {
    this.getSettings = getSettings;
  }

  /** Must be called from a user gesture (tap) so Android allows audio and speech. */
  unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      console.warn('AudioContext unavailable', e);
    }
    const s = synth();
    if (s) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        s.speak(u);
      } catch {
        /* ignore */
      }
    }
  }

  beep(freq = 880, ms = 120, volume = 0.35) {
    if (!this.getSettings().beeps || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  }

  shortBeep() {
    this.beep(880, 110, 0.3);
  }

  goBeep() {
    this.beep(1320, 380, 0.4);
  }

  speak(text, { interrupt = true } = {}) {
    const settings = this.getSettings();
    const s = synth();
    if (!settings.voice || !s || !text) return;
    if (interrupt) s.cancel();
    // Android Chrome sometimes leaves the queue paused.
    s.resume();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(settings.voiceURI);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = 1.05;
    s.speak(u);
  }

  cancel() {
    synth()?.cancel();
  }

  test() {
    this.unlock();
    this.shortBeep();
    this.speak('Voice check. 3, 2, 1.');
  }
}

/**
 * Wire spoken cues to an engine. Returns a function that removes the listeners.
 */
export function attachCues(engine, audio, getSettings, workout) {
  const steps = engine.steps;
  const multiBlock = (workout.blocks || []).length > 1;

  function describe(step) {
    return `${step.name}, ${spokenDuration(step.duration)}`;
  }

  /** The spoken announcement for the step at `index`. */
  function announcement(index) {
    const step = engine.stepAt(index);
    const settings = getSettings();
    if (step.lead) {
      const first = steps[0];
      // Kept short so the 3-2-1 countdown doesn't cut it off.
      return engine.leadIn >= 8 ? `Get ready. First up: ${describe(first)}.` : `Get ready: ${first.name}.`;
    }

    const parts = [];
    const prev = steps[index - 1];
    const firstOfBlock = !prev || prev.blockIdx !== step.blockIdx;
    const firstOfRound = firstOfBlock || prev.round !== step.round;
    const sameAsStep = step.blockName.trim().toLowerCase() === step.name.trim().toLowerCase();
    if (firstOfBlock && multiBlock && step.blockName && !sameAsStep) parts.push(`${step.blockName}.`);
    if (firstOfRound && step.totalRounds > 1) parts.push(`Round ${step.round} of ${step.totalRounds}.`);

    if (step.type === 'rest') {
      const next = steps[index + 1];
      parts.push(`Rest, ${spokenDuration(step.duration)}.`);
      if (next) parts.push(`Next up: ${next.name}.`);
    } else {
      parts.push(`${describe(step)}.`);
      if (settings.readNotes && step.notes) parts.push(step.notes);
    }
    return parts.join(' ');
  }

  function onStepStart(e) {
    if (engine.state !== 'running') return; // jumping while paused stays quiet
    if (e.detail.reason === 'auto') audio.goBeep();
    audio.speak(announcement(e.detail.index));
  }

  function onSecond(e) {
    const { step, secondsLeft } = e.detail;
    const settings = getSettings();
    const d = step.duration;
    if (secondsLeft >= 1 && secondsLeft <= 3 && d >= 5) {
      audio.shortBeep();
      audio.speak(String(secondsLeft));
      return;
    }
    if (secondsLeft === d) return; // step just started
    if (settings.tenSeconds && d >= 30 && secondsLeft === 10) {
      audio.speak('10 seconds', { interrupt: false });
    } else if (settings.halfway && d >= 20 && secondsLeft === Math.floor(d / 2)) {
      audio.speak('Halfway', { interrupt: false });
    }
  }

  const onPause = () => audio.speak('Paused');
  const onResume = () => {
    const step = engine.currentStep();
    const fresh = engine.getRemainingMs() >= step.duration * 1000 - 250;
    // If the step hasn't started yet (e.g. you jumped to it while paused), give the full announcement.
    audio.speak(fresh ? `Resuming. ${announcement(engine.index)}` : `Resuming. ${step.name}.`);
  };
  const onFinish = () => {
    audio.goBeep();
    audio.speak('Workout complete. Nice work!');
  };

  engine.addEventListener('stepstart', onStepStart);
  engine.addEventListener('second', onSecond);
  engine.addEventListener('pause', onPause);
  engine.addEventListener('resume', onResume);
  engine.addEventListener('finish', onFinish);

  return () => {
    engine.removeEventListener('stepstart', onStepStart);
    engine.removeEventListener('second', onSecond);
    engine.removeEventListener('pause', onPause);
    engine.removeEventListener('resume', onResume);
    engine.removeEventListener('finish', onFinish);
  };
}
