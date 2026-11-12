// Built-in workouts. These are read-only; users can duplicate them to edit.

const w = (name, duration, notes = '') => ({ name, type: 'work', duration, notes });
const rest = (duration) => ({ name: 'Rest', type: 'rest', duration, notes: '' });
const warm = (name, duration, notes = '') => ({ name, type: 'warmup', duration, notes });
const cool = (name, duration, notes = '') => ({ name, type: 'cooldown', duration, notes });

/** Interleave work steps with a fixed rest, without a trailing rest. */
function withRests(steps, restSec) {
  const out = [];
  steps.forEach((s, i) => {
    out.push(s);
    if (i < steps.length - 1) out.push(rest(restSec));
  });
  return out;
}

export const BUILTINS = [
  {
    id: 'builtin-7min',
    builtIn: true,
    name: '7-Minute Circuit',
    description: '12 bodyweight moves, 30 seconds each with 10 seconds rest.',
    blocks: [
      {
        name: 'Circuit',
        rounds: 1,
        restBetweenRounds: 0,
        steps: withRests(
          [
            w('Jumping jacks', 30),
            w('Wall sit', 30, 'Thighs parallel to the floor, back flat on the wall.'),
            w('Pushups', 30),
            w('Crunches', 30),
            w('Step-ups', 30, 'Use a sturdy chair or step. Alternate legs.'),
            w('Squats', 30, 'Weight in your heels, chest up.'),
            w('Triceps dips', 30, 'Use a chair edge. Keep elbows pointing back.'),
            w('Plank', 30, 'Straight line from head to heels.'),
            w('High knees', 30),
            w('Lunges', 30, 'Alternate legs.'),
            w('Pushup with rotation', 30, 'After each pushup, rotate up into a side plank.'),
            w('Side plank', 30, 'Switch sides halfway.'),
          ],
          10
        ),
      },
    ],
  },
  {
    id: 'builtin-beginner-hiit',
    builtIn: true,
    name: 'Beginner HIIT',
    description: 'Warm-up, 3 rounds of a simple circuit, then a cool-down.',
    blocks: [
      {
        name: 'Warm-up',
        rounds: 1,
        restBetweenRounds: 0,
        steps: [
          warm('March in place', 45),
          warm('Arm circles', 30, 'Forward for 15 seconds, then backward.'),
          warm('Bodyweight good mornings', 30),
        ],
      },
      {
        name: 'Main circuit',
        rounds: 3,
        restBetweenRounds: 60,
        steps: withRests(
          [
            w('Squats', 30),
            w('Pushups', 30, 'Drop to your knees if you need to.'),
            w('Mountain climbers', 30),
          ],
          20
        ),
      },
      {
        name: 'Cool-down',
        rounds: 1,
        restBetweenRounds: 0,
        steps: [
          cool('Standing quad stretch', 40, 'Switch legs halfway.'),
          cool('Hamstring stretch', 40),
          cool('Deep breathing', 30),
        ],
      },
    ],
  },
  {
    id: 'builtin-short-hiit',
    builtIn: true,
    name: 'Short HIIT',
    description: 'Two sets of five 30-second moves with a 45-second rest between.',
    blocks: [
      {
        name: 'Set 1',
        rounds: 1,
        restBetweenRounds: 0,
        steps: [
          w('Star jumps', 30),
          w('Fast running', 30),
          w('High knees', 30),
          w('Power jacks', 30),
          w('Toe taps', 30),
          rest(45),
        ],
      },
      {
        name: 'Set 2',
        rounds: 1,
        restBetweenRounds: 0,
        steps: [
          w('Star jumps', 30),
          w('Walkouts', 30),
          w('Squats', 30),
          w('Jumping lunges', 30),
          w('London bridges', 30),
        ],
      },
    ],
  },
  {
    id: 'builtin-intermediate-hiit',
    builtIn: true,
    name: 'Intermediate HIIT',
    description: 'Jumping jacks, then six moves of 4 rounds each: 20 seconds on, 10 seconds rest.',
    blocks: [
      { name: 'Warm-up', rounds: 1, restBetweenRounds: 0, steps: [warm('Jumping jacks', 30)] },
      ...[
        'Jump lunge squats',
        'Burpee jumps',
        'Spiderman pushups',
        'Jumping jack torso twist',
        'Bear crawl',
        'Speed skater lunge',
      ].map((name) => ({ name, rounds: 4, restBetweenRounds: 0, steps: [w(name, 20), rest(10)] })),
    ],
  },
  {
    id: 'builtin-core',
    builtIn: true,
    name: 'Core Builder',
    description: '2 rounds of core work with short rests.',
    blocks: [
      {
        name: 'Core',
        rounds: 2,
        restBetweenRounds: 45,
        steps: withRests(
          [
            w('Plank', 40),
            w('Dead bug', 40, 'Lower back pressed into the floor.'),
            w('Bicycle crunches', 40),
            w('Side plank, left', 30),
            w('Side plank, right', 30),
            w('Glute bridge', 40, 'Squeeze at the top.'),
          ],
          15
        ),
      },
    ],
  },
  {
    id: 'builtin-stretch',
    builtIn: true,
    name: 'Cool-down Stretch',
    description: 'Gentle full-body stretch, about 6 minutes.',
    blocks: [
      {
        name: 'Stretch',
        rounds: 1,
        restBetweenRounds: 0,
        steps: [
          cool('Neck rolls', 30, 'Slow circles, both directions.'),
          cool('Shoulder stretch, left', 30),
          cool('Shoulder stretch, right', 30),
          cool('Standing forward fold', 45),
          cool('Quad stretch, left', 30),
          cool('Quad stretch, right', 30),
          cool('Hip flexor lunge, left', 40),
          cool('Hip flexor lunge, right', 40),
          cool("Child's pose", 45),
          cool('Lying spinal twist', 45, 'Switch sides halfway.'),
        ],
      },
    ],
  },
];
