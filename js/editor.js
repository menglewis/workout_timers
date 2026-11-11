// Workout editor: name, description, blocks (with rounds) and steps.
import { getWorkout, saveWorkout } from './storage.js';
import {
  STEP_TYPES,
  newWorkout,
  newBlock,
  newStep,
  newId,
  clone,
  totalDuration,
  expand,
  formatTime,
  validate,
} from './model.js';
import { esc, icons, toast } from './ui.js';

export function renderEditor(root, [id, fromId], app) {
  let isNew = id === 'new';
  let w;
  if (isNew && fromId) {
    const src = getWorkout(fromId);
    w = src ? { ...clone(src), id: newId(), name: `${src.name} (copy)` } : newWorkout();
    delete w.builtIn;
  } else if (isNew) {
    w = newWorkout();
    w.blocks[0].steps = [newStep({ name: '', type: 'work', duration: 30 }), newStep({ name: 'Rest', type: 'rest', duration: 15 })];
  } else {
    const src = getWorkout(id);
    if (!src || src.builtIn) {
      app.navigate('#/', { replace: true });
      return;
    }
    w = clone(src);
  }

  let dirty = false;
  let saved = false;
  let errors = [];

  function typeOptions(selected) {
    return STEP_TYPES.map(
      (t) => `<option value="${t.value}"${t.value === selected ? ' selected' : ''}>${t.label}</option>`
    ).join('');
  }

  function stepHTML(s, bi, si, count) {
    return `<div class="estep t-${s.type}" data-b="${bi}" data-s="${si}">
      <div class="estep-row">
        <input class="name" data-field="name" value="${esc(s.name)}" placeholder="Exercise name" aria-label="Step name" />
        <select data-field="type" aria-label="Step type">${typeOptions(s.type)}</select>
      </div>
      <div class="estep-row">
        <div class="stepper">
          <button type="button" data-act="dur-" aria-label="5 seconds less">−5</button>
          <input type="number" inputmode="numeric" min="1" max="3600" data-field="duration" value="${s.duration}" aria-label="Duration in seconds" />
          <button type="button" data-act="dur+" aria-label="5 seconds more">+5</button>
        </div>
        <span class="fmt">${formatTime(s.duration)}</span>
      </div>
      <div class="estep-row">
        <input data-field="notes" value="${esc(s.notes)}" placeholder="Notes / form cue (optional)" aria-label="Notes" />
      </div>
      <div class="estep-actions">
        <button type="button" class="icon-btn" data-act="step-up" aria-label="Move up"${si === 0 ? ' disabled' : ''}>${icons.up}</button>
        <button type="button" class="icon-btn" data-act="step-down" aria-label="Move down"${si === count - 1 ? ' disabled' : ''}>${icons.down}</button>
        <button type="button" class="icon-btn" data-act="step-copy" aria-label="Duplicate step">${icons.copy}</button>
        <button type="button" class="icon-btn" data-act="step-del" aria-label="Delete step">${icons.trash}</button>
      </div>
    </div>`;
  }

  function blockHTML(b, bi) {
    const n = w.blocks.length;
    return `<section class="block" data-b="${bi}">
      <div class="block-head">
        <input data-bfield="name" value="${esc(b.name)}" placeholder="Block name" aria-label="Block name" />
        <button type="button" class="icon-btn" data-act="block-up" aria-label="Move block up"${bi === 0 ? ' disabled' : ''}>${icons.up}</button>
        <button type="button" class="icon-btn" data-act="block-down" aria-label="Move block down"${bi === n - 1 ? ' disabled' : ''}>${icons.down}</button>
        <button type="button" class="icon-btn" data-act="block-del" aria-label="Delete block">${icons.trash}</button>
      </div>
      <div class="block-opts">
        <label class="field"><span>Rounds</span>
          <div class="stepper">
            <button type="button" data-act="rounds-" aria-label="Fewer rounds">−</button>
            <input type="number" inputmode="numeric" min="1" max="99" data-bfield="rounds" value="${b.rounds}" />
            <button type="button" data-act="rounds+" aria-label="More rounds">+</button>
          </div>
        </label>
        <label class="field"><span>Rest between rounds (s)</span>
          <input type="number" inputmode="numeric" min="0" max="3600" data-bfield="restBetweenRounds" value="${b.restBetweenRounds}" />
        </label>
      </div>
      ${b.steps.map((s, si) => stepHTML(s, bi, si, b.steps.length)).join('')}
      <div class="add-row">
        <button type="button" class="btn small" data-act="add-work">${icons.plus} Exercise</button>
        <button type="button" class="btn small" data-act="add-rest">${icons.plus} Rest</button>
      </div>
    </section>`;
  }

  function render() {
    root.innerHTML = `
      <header class="topbar">
        <a class="icon-btn" href="${isNew ? '#/' : '#/workout/' + encodeURIComponent(w.id)}" aria-label="Back">${icons.back}</a>
        <h1>${isNew ? 'New workout' : 'Edit workout'}</h1>
      </header>
      <form id="editor" novalidate>
        <label class="field"><span>Name</span>
          <input data-wfield="name" value="${esc(w.name)}" placeholder="e.g. Morning burner" required />
        </label>
        <label class="field"><span>Description (optional)</span>
          <input data-wfield="description" value="${esc(w.description)}" placeholder="What is this workout?" />
        </label>
        <div id="blocks">${w.blocks.map(blockHTML).join('')}</div>
        <button type="button" class="btn big" data-act="add-block">${icons.plus} Add block</button>
        <p class="muted" style="font-size:0.85rem;line-height:1.4">
          Blocks repeat for their number of rounds. Use separate blocks for a warm-up, the main set and a cool-down.
        </p>
        <div id="errors"></div>
        <div class="savebar">
          <div class="total"><strong id="total">${formatTime(totalDuration(w))}</strong> · <span id="count">${expand(w).length}</span> steps</div>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </form>`;
    renderErrors();
  }

  function renderErrors() {
    const box = root.querySelector('#errors');
    box.innerHTML = errors.length
      ? `<div class="editor-errors" role="alert"><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`
      : '';
  }

  function updateTotals() {
    root.querySelector('#total').textContent = formatTime(totalDuration(w));
    root.querySelector('#count').textContent = expand(w).length;
  }

  function locate(target) {
    const stepEl = target.closest('[data-s]');
    const blockEl = target.closest('[data-b]');
    const bi = blockEl ? Number(blockEl.dataset.b) : null;
    const si = stepEl ? Number(stepEl.dataset.s) : null;
    return { bi, si, block: bi !== null ? w.blocks[bi] : null, step: bi !== null && si !== null ? w.blocks[bi].steps[si] : null, stepEl };
  }

  function clampInt(v, min, max) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function move(arr, i, delta) {
    const j = i + delta;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // ---- input (no re-render, keeps focus) ----
  root.addEventListener('input', (e) => {
    const t = e.target;
    dirty = true;
    if (t.dataset.wfield) {
      w[t.dataset.wfield] = t.value;
      return;
    }
    const { block, step, stepEl } = locate(t);
    if (t.dataset.bfield && block) {
      const f = t.dataset.bfield;
      if (f === 'name') block.name = t.value;
      else if (f === 'rounds') block.rounds = clampInt(t.value, 1, 99);
      else if (f === 'restBetweenRounds') block.restBetweenRounds = clampInt(t.value, 0, 3600);
      updateTotals();
      return;
    }
    if (t.dataset.field && step) {
      const f = t.dataset.field;
      if (f === 'duration') {
        step.duration = clampInt(t.value, 1, 3600);
        stepEl.querySelector('.fmt').textContent = formatTime(step.duration);
      } else if (f === 'type') {
        step.type = t.value;
        stepEl.className = `estep t-${step.type}`;
        if (step.type === 'rest' && !step.name) {
          step.name = 'Rest';
          stepEl.querySelector('[data-field="name"]').value = 'Rest';
        }
      } else {
        step[f] = t.value;
      }
      updateTotals();
    }
  });

  // Normalise number inputs when they lose focus (e.g. empty -> minimum).
  root.addEventListener(
    'blur',
    (e) => {
      const t = e.target;
      if (t.type !== 'number') return;
      const { block, step } = locate(t);
      if (t.dataset.field === 'duration' && step) t.value = step.duration;
      if (t.dataset.bfield && block && t.dataset.bfield !== 'name') t.value = block[t.dataset.bfield];
    },
    true
  );

  // ---- buttons (structural changes re-render) ----
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const { bi, si, block, step } = locate(btn);
    dirty = true;

    switch (act) {
      case 'dur-':
      case 'dur+': {
        step.duration = clampInt(step.duration + (act === 'dur+' ? 5 : -5), 1, 3600);
        const stepEl = btn.closest('.estep');
        stepEl.querySelector('[data-field="duration"]').value = step.duration;
        stepEl.querySelector('.fmt').textContent = formatTime(step.duration);
        updateTotals();
        return;
      }
      case 'rounds-':
      case 'rounds+': {
        block.rounds = clampInt(block.rounds + (act === 'rounds+' ? 1 : -1), 1, 99);
        btn.closest('.stepper').querySelector('input').value = block.rounds;
        updateTotals();
        return;
      }
      case 'step-up':
        move(block.steps, si, -1);
        break;
      case 'step-down':
        move(block.steps, si, 1);
        break;
      case 'step-copy':
        block.steps.splice(si + 1, 0, clone(step));
        break;
      case 'step-del':
        if (block.steps.length === 1) {
          toast('A block needs at least one step. Delete the block instead.');
          return;
        }
        block.steps.splice(si, 1);
        break;
      case 'add-work':
        block.steps.push(newStep({ type: 'work', duration: 30 }));
        break;
      case 'add-rest':
        block.steps.push(newStep({ name: 'Rest', type: 'rest', duration: 15 }));
        break;
      case 'block-up':
        move(w.blocks, bi, -1);
        break;
      case 'block-down':
        move(w.blocks, bi, 1);
        break;
      case 'block-del':
        if (w.blocks.length === 1) {
          toast('A workout needs at least one block.');
          return;
        }
        if (!confirm(`Delete block ${bi + 1} and its ${block.steps.length} steps?`)) return;
        w.blocks.splice(bi, 1);
        break;
      case 'add-block':
        w.blocks.push(newBlock());
        break;
      default:
        return;
    }
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    if (act === 'add-work' || act === 'add-rest') {
      const steps = root.querySelectorAll(`.block[data-b="${bi}"] .estep`);
      const last = steps[steps.length - 1];
      last?.scrollIntoView({ block: 'center' });
      if (act === 'add-work') last?.querySelector('[data-field="name"]').focus();
    } else if (act === 'add-block') {
      root.querySelector(`.block[data-b="${w.blocks.length - 1}"]`)?.scrollIntoView({ block: 'start' });
    }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    w.name = (w.name || '').trim();
    w.blocks.forEach((b) => b.steps.forEach((s) => (s.name = (s.name || '').trim())));
    errors = validate(w);
    renderErrors();
    if (errors.length) {
      root.querySelector('#errors').scrollIntoView({ block: 'center' });
      return;
    }
    if (!saveWorkout(w)) {
      toast('Could not save. Storage may be full.');
      return;
    }
    saved = true;
    toast('Workout saved');
    app.navigate('#/workout/' + encodeURIComponent(w.id), { replace: true });
  });

  render();

  return {
    beforeLeave() {
      if (saved || !dirty) return true;
      return confirm('Discard unsaved changes?');
    },
  };
}
