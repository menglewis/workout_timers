// Timer engine: a DOM-free state machine over a flat list of steps.
//
// Timing is timestamp based: while running we store `endsAt` and compute the
// remaining time from the clock on every tick, so the timer never drifts and
// catches up correctly if the browser throttles intervals.
//
// Index -1 is the optional "Get ready" lead-in before the first step.
//
// Events (CustomEvent, data in `detail`):
//   stepstart { index, step, reason: 'start'|'auto'|'jump' }
//   second    { index, step, secondsLeft }   (once per whole second, while running)
//   tick      {}                              (every interval, for smooth UI)
//   pause, resume, finish, statechange

const TICK_MS = 200;

export class Engine extends EventTarget {
  constructor(steps, { leadIn = 0 } = {}) {
    super();
    this.steps = steps;
    this.leadIn = Math.max(0, leadIn | 0);
    this.leadStep = { name: 'Get ready', type: 'prep', duration: this.leadIn, notes: '', lead: true };
    this.state = 'idle'; // idle | running | paused | finished
    this.index = this.leadIn > 0 ? -1 : 0;
    this.remainingMs = this.currentStep().duration * 1000;
    this.endsAt = 0;
    this.lastSecond = null;
    this.timer = null;
  }

  // ---- queries ----

  stepAt(i) {
    return i === -1 ? this.leadStep : this.steps[i];
  }

  currentStep() {
    return this.stepAt(this.index);
  }

  nextStep() {
    return this.steps[this.index + 1] || null;
  }

  getRemainingMs() {
    if (this.state === 'running') return Math.max(0, this.endsAt - performance.now());
    return this.remainingMs;
  }

  getSecondsLeft() {
    return Math.ceil(this.getRemainingMs() / 1000);
  }

  /** Seconds elapsed across the whole workout (excluding lead-in). */
  getElapsedTotal() {
    if (this.index < 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.index; i++) sum += this.steps[i].duration;
    if (this.state === 'finished') return sum + this.currentStep().duration;
    return sum + (this.currentStep().duration - this.getRemainingMs() / 1000);
  }

  getTotal() {
    return this.steps.reduce((s, x) => s + x.duration, 0);
  }

  // ---- controls ----

  start() {
    if (this.state !== 'idle') return;
    this._setState('running');
    this._beginStep(this.index, 'start');
  }

  pause() {
    if (this.state !== 'running') return;
    this.remainingMs = Math.max(0, this.endsAt - performance.now());
    this._stopTimer();
    this._setState('paused');
    this._emit('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.endsAt = performance.now() + this.remainingMs;
    this._setState('running');
    this._startTimer();
    this._emit('resume');
  }

  toggle() {
    if (this.state === 'running') this.pause();
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'idle') this.start();
  }

  next() {
    if (this.state === 'idle' || this.state === 'finished') return;
    if (this.index < this.steps.length - 1) this.jumpTo(this.index + 1);
    else this._finish();
  }

  /** Restart the current step if more than 3s in, otherwise go back one step. */
  prev() {
    if (this.state === 'idle') return;
    const elapsed = this.currentStep().duration - this.getRemainingMs() / 1000;
    if (this.state !== 'finished' && (elapsed > 3 || this.index <= 0)) this.restartStep();
    else this.jumpTo(Math.max(this.index - 1, this.leadIn > 0 ? -1 : 0));
  }

  restartStep() {
    this.jumpTo(this.index);
  }

  jumpTo(i) {
    if (i < -1 || i >= this.steps.length || (i === -1 && this.leadIn === 0)) return;
    if (this.state === 'idle' || this.state === 'finished') this._setState('paused');
    this._beginStep(i, 'jump');
  }

  /** Start the whole workout over from the beginning (lead-in included). */
  restart() {
    this._stopTimer();
    this.state = 'idle';
    this.index = this.leadIn > 0 ? -1 : 0;
    this.start();
  }

  stop() {
    this._stopTimer();
    this._setState('idle');
  }

  // ---- internals ----

  _beginStep(i, reason) {
    this.index = i;
    const durMs = this.currentStep().duration * 1000;
    this.remainingMs = durMs;
    this.lastSecond = null;
    if (this.state === 'running') {
      this.endsAt = performance.now() + durMs;
      this._startTimer();
    }
    this._emit('stepstart', { index: i, step: this.currentStep(), reason });
    if (this.state === 'running') this._tick();
    else this._emit('tick');
  }

  _tick() {
    if (this.state !== 'running') return;
    const now = performance.now();
    let left = this.endsAt - now;

    if (left <= 0) {
      // Advance, carrying any overshoot so the schedule stays aligned. If we were
      // throttled for a long time this may skip several steps at once.
      let i = this.index;
      let endsAt = this.endsAt;
      while (endsAt - now <= 0) {
        if (i >= this.steps.length - 1) {
          this._finish();
          return;
        }
        i++;
        endsAt += this.steps[i].duration * 1000;
      }
      this.index = i;
      this.endsAt = endsAt;
      this.lastSecond = null;
      this._emit('stepstart', { index: i, step: this.currentStep(), reason: 'auto' });
      left = this.endsAt - now;
    }

    const secs = Math.ceil(left / 1000);
    if (secs !== this.lastSecond) {
      this.lastSecond = secs;
      this._emit('second', { index: this.index, step: this.currentStep(), secondsLeft: secs });
    }
    this._emit('tick');
  }

  _finish() {
    this._stopTimer();
    this.remainingMs = 0;
    this._setState('finished');
    this._emit('finish');
    this._emit('tick');
  }

  _startTimer() {
    if (!this.timer) this.timer = setInterval(() => this._tick(), TICK_MS);
  }

  _stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this._emit('statechange', { state: s });
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
