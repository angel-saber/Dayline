import { node } from '../../shared/dom.js?v=b8179ad8cdac';
import { typeChips } from '../notes/note-types.js?v=b8179ad8cdac';
import {
  ACCESS,
  INTEREST,
  PERMISSIONS,
  BREATHS,
  RECOVERY_CHOICES,
  ACKNOWLEDGMENTS,
} from './flow-model.js?v=b8179ad8cdac';
import { breathingFrame } from '../activities/model.js?v=b8179ad8cdac';
const button = (text, action) => {
  const b = node('button', 'secondary', text);
  b.type = 'button';
  b.onclick = action;
  return b;
};
function field(root, label, value, change, { rows = 2, placeholder = '', max = 10000 } = {}) {
  const wrap = node('label', 'flow-field', label),
    input = node('textarea');
  input.rows = rows;
  input.maxLength = max;
  input.value = value;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => change(input.value));
  wrap.append(input);
  root.append(wrap);
  return input;
}
function check(root, label, value, change) {
  const wrap = node('label', 'flow-check'),
    input = node('input');
  input.type = 'checkbox';
  input.checked = value;
  input.setAttribute('aria-label', label);
  input.onchange = () => change(input.checked);
  wrap.append(input, document.createTextNode(label));
  root.append(wrap);
  return input;
}
function suggestions(root, choices, input, change) {
  const buttons = node('div', 'flow-options');
  for (const [title, text] of choices)
    buttons.append(
      button(title, () => {
        const lines = input.value.split('\n');
        if (!lines.includes(text)) input.value = [input.value, text].filter(Boolean).join('\n');
        change(input.value);
        input.focus();
      }),
    );
  root.append(buttons);
}
export function compactFlow(flow, { onChange, categories, mantra, showFirst = true }) {
  const root = node('section', 'flow-compact');
  root.append(node('h2', '', 'Your focus plan'));
  root.append(
    node(
      'p',
      'field-hint',
      'Optional: edit these directly, or use the extra preparation for help. Outcome categories belong to this session, not your note.',
    ),
  );
  field(
    root,
    'Outcome',
    flow.outcome,
    (v) => {
      flow.outcome = v;
      onChange();
    },
    { rows: 1, placeholder: 'What would you like to move forward?' },
  );
  root.append(
    typeChips(
      flow.tags,
      'Outcome categories',
      (tags) => {
        flow.tags = tags;
        onChange();
      },
      categories,
    ).element,
  );
  const grid = node('div', 'flow-compact-grid');
  field(
    grid,
    'Evidence of progress',
    flow.evidence,
    (v) => {
      flow.evidence = v;
      onChange();
    },
    { rows: 1, placeholder: 'What will show you that you’re making progress?' },
  );
  if (showFirst)
    field(
      grid,
      'First move',
      flow.steps[0].action,
      (v) => {
        flow.steps[0].action = v;
        onChange();
      },
      { rows: 1, max: 2000 },
    );
  if (showFirst)
    field(
      grid,
      'Approach',
      flow.steps[0].strategy,
      (v) => {
        flow.steps[0].strategy = v;
        onChange();
      },
      { rows: 1, max: 2000 },
    );
  root.append(grid);
  if (mantra !== undefined)
    root.append(node('p', 'flow-commitment-preview', `Commitment: ${mantra}`));
  return root;
}
export function stepList(flow, onChange) {
  const root = node('div', 'flow-steps');
  function render() {
    root.replaceChildren();
    flow.steps.forEach((step, index) => {
      const row = node('div', 'flow-step');
      check(row, `Step ${index + 1} complete`, step.done, (v) => {
        step.done = v;
        onChange();
      });
      field(
        row,
        `Step ${index + 1}`,
        step.action,
        (v) => {
          step.action = v;
          onChange();
        },
        { rows: 1, max: 2000 },
      );
      field(
        row,
        `How I’ll approach step ${index + 1}`,
        step.strategy,
        (v) => {
          step.strategy = v;
          onChange();
        },
        { rows: 1, max: 2000 },
      );
      if (flow.steps.length > 1)
        row.append(
          button('Remove step', () => {
            flow.steps.splice(index, 1);
            onChange();
            render();
          }),
        );
      root.append(row);
    });
    root.append(
      button('＋ Add another step', () => {
        if (flow.steps.length < 30) {
          flow.steps.push({ action: '', strategy: '', done: false });
          onChange();
          render();
          root.querySelectorAll('textarea')[root.querySelectorAll('textarea').length - 2]?.focus();
        }
      }),
    );
  }
  render();
  return root;
}
export function createFlowPreparation({
  flow,
  categories,
  onChange,
  onBack,
  onBegin,
  onAudio,
  onSaveWarmup,
}) {
  const root = node('section', 'flow-preparation focus-prep-fields');
  root.append(
    node(
      'p',
      'field-hint',
      'Make the task engaging, the next move clear, and your attention available. Everything is optional; begin whenever you’re ready.',
    ),
  );
  function section(title, open = false) {
    const d = node('details', 'flow-part');
    d.open = open;
    d.append(node('summary', '', title));
    root.append(d);
    return d;
  }
  const balance = section('1. Challenge–Skill Balance · Find a way into the task', true),
    choices = node('div', 'flow-options');
  const interest = node('div'),
    access = node('div');
  const readiness = [
    ['compelling', 'Make it more compelling'],
    ['manageable', 'Make it more manageable'],
    ['both', 'Both'],
    ['ready', 'I’m ready'],
  ];
  function syncBalance() {
    interest.hidden = !['', 'compelling', 'both'].includes(flow.readiness);
    access.hidden = !['', 'manageable', 'both'].includes(flow.readiness);
    for (const b of choices.children)
      b.setAttribute('aria-pressed', String(b.dataset.choice === flow.readiness));
  }
  for (const [key, label] of readiness) {
    const b = button(label, () => {
      flow.readiness = key;
      onChange();
      syncBalance();
    });
    b.dataset.choice = key;
    choices.append(b);
  }
  balance.append(
    node('p', '', 'What would help you engage with this right now?'),
    choices,
    interest,
    access,
  );
  const interesting = field(
    interest,
    'What would make this more compelling right now?',
    flow.interest,
    (v) => {
      flow.interest = v;
      onChange();
    },
  );
  suggestions(interest, INTEREST, interesting, (v) => {
    flow.interest = v;
    onChange();
  });
  const accessible = field(
    access,
    'What would make this easier to start doing?',
    flow.access,
    (v) => {
      flow.access = v;
      onChange();
    },
  );
  suggestions(access, ACCESS, accessible, (v) => {
    flow.access = v;
    onChange();
  });
  syncBalance();
  const goal = section('2. Clear Goal and Feedback · Choose a target you can act on');
  field(goal, 'Outcome', flow.outcome, (v) => {
    flow.outcome = v;
    onChange();
  });
  goal.append(
    typeChips(
      flow.tags,
      'Outcome categories',
      (tags) => {
        flow.tags = tags;
        onChange();
      },
      categories,
    ).element,
  );
  const evidence = field(goal, 'Evidence of progress', flow.evidence, (v) => {
    flow.evidence = v;
    onChange();
  });
  suggestions(
    goal,
    [
      'Rough draft',
      'Working test',
      'Decision',
      'Practice attempt',
      'Completed section',
      'Clearer question',
    ].map((v) => [v, v]),
    evidence,
    (v) => {
      flow.evidence = v;
      onChange();
    },
  );
  goal.append(stepList(flow, onChange));
  field(goal, 'If I get stuck…', flow.ifStuck, (v) => {
    flow.ifStuck = v;
    onChange();
  });
  const permission = section('3. Step Out of Self-Judgment · Let yourself attempt it');
  const fear = field(permission, 'What are you afraid might happen?', flow.fear, (v) => {
    flow.fear = v;
    onChange();
  });
  const allow = field(
    permission,
    'What will you give yourself permission to risk so you can proceed?',
    flow.permission,
    (v) => {
      flow.permission = v;
      onChange();
    },
  );
  const fears = node('div', 'flow-options');
  for (const [label, text] of PERMISSIONS)
    fears.append(
      button(label, () => {
        fear.value = flow.fear = [flow.fear, label].filter(Boolean).join('\n');
        allow.value = flow.permission = [flow.permission, text].filter(Boolean).join('\n');
        onChange();
      }),
    );
  permission.append(fears);
  const warmups = node('div', 'flow-options'),
    warmup = node('section', 'flow-warmup');
  permission.append(node('h3', '', 'Choose a warm-up (optional)'), warmups, warmup);
  let breathingAt = null,
    timerUntil = null;
  const warmupOptions = [
    ['breathing', 'Breathe with intention'],
    ['movement', 'Move into the task'],
    ['rehearse', 'Rehearse the first move'],
    ['rough', 'Make a low-stakes attempt'],
    ['ritual', 'Use my own ritual'],
  ];
  for (const [key, label] of warmupOptions) {
    const b = button(label, () => {
      flow.warmup = key;
      breathingAt = null;
      timerUntil = null;
      onChange();
      renderWarmup();
    });
    b.dataset.warmup = key;
    warmups.append(b);
  }
  function renderWarmup() {
    warmup.replaceChildren();
    for (const b of warmups.children)
      b.setAttribute('aria-pressed', String(b.dataset.warmup === flow.warmup));
    if (flow.warmup === 'movement')
      warmup.append(
        node(
          'p',
          '',
          'Plant your feet, bring your hands to what you’re working with, and make the first small move. Adapt this to a movement that is comfortable and available to you.',
        ),
      );
    if (flow.warmup === 'breathing') {
      warmup.append(
        node(
          'p',
          'field-hint',
          'Breathe comfortably without holding or forcing your breath. Follow the words at your own pace; the animation is optional.',
        ),
      );
      const inField = field(
          warmup,
          'Inhale…',
          flow.breathIn,
          (v) => {
            flow.breathIn = v;
            onChange();
          },
          { rows: 1 },
        ),
        outField = field(
          warmup,
          'Exhale…',
          flow.breathOut,
          (v) => {
            flow.breathOut = v;
            onChange();
          },
          { rows: 1 },
        );
      const pairs = node('div', 'flow-options');
      for (const [inside, outside] of BREATHS)
        pairs.append(
          button(`Inhale ${inside}. Exhale ${outside}.`, () => {
            flow.breathIn = inField.value = inside;
            flow.breathOut = outField.value = outside;
            onChange();
          }),
        );
      warmup.append(pairs);
      const circle = node('div', 'flow-breath-circle'),
        instruction = node('p', 'flow-breath-instruction');
      warmup.append(
        circle,
        instruction,
        button('Start / stop breathing animation', () => {
          breathingAt = breathingAt === null ? Date.now() : null;
          tick();
        }),
      );
    }
    if (['rehearse', 'rough'].includes(flow.warmup)) {
      warmup.append(
        node(
          'p',
          '',
          flow.warmup === 'rehearse'
            ? 'Practice the opening action once, then let the next attempt become the task.'
            : 'Try a rough sentence, sketch idea, calculation, or practice run. It can stay imperfect.',
        ),
      );
      field(warmup, 'Warm-up attempt', flow.warmupText, (v) => {
        flow.warmupText = v;
        onChange();
      });
      const status = node('p', 'field-hint');
      status.setAttribute('role', 'status');
      warmup.append(
        button('Keep this in my note', () => {
          if (!flow.warmupText.trim()) {
            status.textContent = 'Write something to keep first.';
            return;
          }
          if (flow.warmupText === flow.warmupSavedText) {
            status.textContent = 'This attempt is already in your note.';
            return;
          }
          if (onSaveWarmup(flow.warmupText)) {
            flow.warmupSavedText = flow.warmupText;
            onChange();
            status.textContent = 'Added to your note.';
          } else status.textContent = 'Could not save. Your warm-up is still here.';
        }),
        status,
      );
    }
    if (flow.warmup === 'ritual') {
      field(warmup, 'My starting ritual', flow.ritual, (v) => {
        flow.ritual = v;
        onChange();
      });
      const label = node('label', 'flow-field', 'Optional warm-up timer (minutes)'),
        minutes = node('input');
      minutes.type = 'number';
      minutes.min = '1';
      minutes.max = '30';
      minutes.value = '2';
      minutes.setAttribute('aria-label', 'Warm-up timer minutes');
      label.append(minutes);
      warmup.append(
        label,
        button('Start warm-up timer', () => {
          const n = Number(minutes.value);
          if (Number.isInteger(n) && n >= 1 && n <= 30) {
            timerUntil = Date.now() + n * 60000;
            tick();
          }
        }),
        node('p', 'flow-warmup-timer'),
      );
    }
    if (flow.warmup) warmup.append(button('I’ve started—begin session', onBegin));
  }
  renderWarmup();
  const attention = section('4. Protect Your Attention · Give the task somewhere to unfold');
  attention.append(
    button('Choose / open Focus Audio', onAudio),
    node(
      'p',
      'field-hint',
      'Keep what is already playing, choose another soundtrack, or work in silence.',
    ),
  );
  field(
    attention,
    'Park distractions before starting',
    flow.parked,
    (v) => {
      flow.parked = v;
      onChange();
    },
    { placeholder: 'These will stay with your interruption log.' },
  );
  for (const [key, label] of [
    ['dnd', 'Put my device on Do Not Disturb'],
    ['tabs', 'Close distracting tabs'],
    ['materials', 'Put what I need within reach'],
    ['people', 'Let others know I’m focusing'],
  ])
    check(attention, label, flow.space[key], (v) => {
      flow.space[key] = v;
      onChange();
    });
  attention.append(
    node(
      'p',
      'field-hint',
      'These are actions for you to take; Dayline does not change device settings.',
    ),
  );
  check(attention, 'Hide the session clock', flow.hideClock, (v) => {
    flow.hideClock = v;
    onChange();
  });
  const footer = node('div', 'flow-preparation-actions focus-commitment');
  const begin = button('Begin Focus', onBegin);
  begin.className = 'primary';
  footer.append(button('Back to Focus setup', onBack), begin);
  root.append(footer);
  function tick() {
    const circle = warmup.querySelector('.flow-breath-circle'),
      label = warmup.querySelector('.flow-breath-instruction');
    if (circle && label) {
      if (breathingAt === null) {
        label.textContent = `Inhale ${flow.breathIn}. Exhale ${flow.breathOut}.`;
        circle.style.transform = 'scale(.8)';
      } else {
        const frame = breathingFrame(Date.now() - breathingAt, 'calm');
        circle.style.transform = `scale(${0.65 + 0.35 * frame.expansion})`;
        label.textContent = frame.done
          ? 'Continue when ready.'
          : `${frame.instruction.startsWith('Inhale') ? 'Inhale ' + flow.breathIn : 'Exhale ' + flow.breathOut}.`;
        if (frame.done) breathingAt = null;
      }
    }
    const countdown = warmup.querySelector('.flow-warmup-timer');
    if (countdown && timerUntil) {
      const remaining = Math.max(0, Math.ceil((timerUntil - Date.now()) / 1000));
      countdown.textContent = remaining
        ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`
        : 'Warm-up timer finished. Begin when ready.';
    }
  }
  tick();
  const timer = setInterval(tick, 250);
  return {
    element: root,
    destroy() {
      clearInterval(timer);
    },
  };
}
export function recoverySection(recovery, onChange) {
  const root = node('section', 'focus-recovery');
  root.append(
    node('h2', '', 'Recover and celebrate'),
    node('p', '', 'You showed up. Let your effort settle.'),
  );
  const label = node('label', 'flow-field', 'Break duration (minutes)'),
    minutes = node('input');
  minutes.type = 'number';
  minutes.min = '1';
  minutes.max = '120';
  minutes.value = String(recovery.minutes);
  minutes.setAttribute('aria-label', 'Break duration (minutes)');
  minutes.oninput = () => {
    const n = Number(minutes.value);
    if (Number.isInteger(n) && n >= 1 && n <= 120) {
      recovery.minutes = n;
      minutes.setCustomValidity('');
      onChange();
    } else minutes.setCustomValidity('Choose 1–120 whole minutes.');
  };
  label.append(minutes);
  root.append(
    label,
    node(
      'p',
      'field-hint',
      'Suggested from your session length. Change it to suit you; these are optional starting points, not required ratios.',
    ),
  );
  const options = node('div', 'flow-options');
  for (const value of RECOVERY_CHOICES) {
    const b = button(value, () => {
      recovery.activity = recovery.activity === value ? '' : value;
      onChange();
      for (const item of options.children)
        item.setAttribute('aria-pressed', String(item.textContent === recovery.activity));
      custom.parentElement.hidden = recovery.activity !== 'Choose my own';
    });
    b.setAttribute('aria-pressed', String(recovery.activity === value));
    options.append(b);
  }
  root.append(node('h3', '', 'What would help you recover now?'), options);
  const custom = field(
    root,
    'My recovery choice',
    recovery.custom,
    (v) => {
      recovery.custom = v;
      onChange();
    },
    { rows: 1, max: 2000 },
  );
  custom.parentElement.hidden = recovery.activity !== 'Choose my own';
  const wins = node('div', 'flow-options');
  for (const value of ACKNOWLEDGMENTS) {
    const b = button(value, () => {
      recovery.acknowledgment = recovery.acknowledgment === value ? '' : value;
      onChange();
      for (const item of wins.children)
        item.setAttribute('aria-pressed', String(item.textContent === recovery.acknowledgment));
    });
    b.setAttribute('aria-pressed', String(recovery.acknowledgment === value));
    wins.append(b);
  }
  root.append(node('h3', '', 'Recognize what happened (optional)'), wins);
  field(root, 'A win, lesson, or effort to acknowledge', recovery.win, (v) => {
    recovery.win = v;
    onChange();
  });
  check(root, 'Play a celebration effect when I save', recovery.celebrate, (v) => {
    recovery.celebrate = v;
    onChange();
  });
  check(root, 'Start an independent break timer after saving', recovery.startTimer, (v) => {
    recovery.startTimer = v;
    onChange();
  });
  return root;
}
