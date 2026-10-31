import { node } from '../../shared/dom.js?v=a5e287120672';
import { ACCESS, INTEREST, PERMISSIONS, BREATHS } from './flow-model.js?v=a5e287120672';
import { breathingFrame } from '../activities/model.js?v=a5e287120672';
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
export function createFlowPreparation({ flow, onChange, onAudio, onSaveWarmup }) {
  const root = node('section', 'focus-help-sections');
  root.append(
    node(
      'p',
      'field-hint',
      'Open only what would help you. Everything here is optional and saves as you go.',
    ),
  );
  function section(title, key) {
    const d = node('details', 'flow-part focus-advice');
    d.dataset.supportArea = key;
    d.open = false;
    d.append(node('summary', '', title));
    root.append(d);
    d.addEventListener('toggle', () => {
      if (key === 'judgment' && !d.open) {
        breathingAt = null;
        timerUntil = null;
      }
    });
    return d;
  }
  const balance = section('How can this feel more engaging or manageable?', 'balance'),
    choices = node('div', 'flow-options');
  const interest = node('div'),
    access = node('div');
  const readiness = [
    ['compelling', 'Make it more compelling'],
    ['manageable', 'Make it more manageable'],
    ['both', 'Both'],
  ];
  function syncBalance() {
    const readiness = flow.readiness === 'ready' ? '' : flow.readiness;
    interest.hidden = !['', 'compelling', 'both'].includes(readiness);
    access.hidden = !['', 'manageable', 'both'].includes(readiness);
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
  const goal = section('What would count as progress?', 'goals');
  goal.append(
    node(
      'p',
      '',
      'Choose a sign of progress and one small action. A rough attempt or clearer understanding can count.',
    ),
  );
  const progressChoices = node('div', 'flow-options');
  let progressChoice = flow.progressChoice || (flow.evidence.trim() ? 'own' : '');
  function syncProgressChoice() {
    for (const button of progressChoices.children)
      button.setAttribute('aria-pressed', String(button.dataset.progressChoice === progressChoice));
  }
  const progress = field(
    goal,
    'Progress I want to see',
    flow.evidence,
    (value) => {
      flow.evidence = value;
      if (progressChoice) {
        flow.progressDrafts ||= {};
        flow.progressDrafts[progressChoice] = value;
      }
      onChange();
    },
    { rows: 1 },
  );
  progress.parentElement.hidden = !flow.evidence.trim();
  for (const [key, label, starter] of [
    ['rough', 'A rough version', 'A rough version of…'],
    ['piece', 'One finished piece', 'One finished piece of…'],
    ['decision', 'A decision', 'A decision about…'],
    ['test', 'Something tested', 'Test whether…'],
    ['understand', 'A clearer understanding', 'A clearer understanding of…'],
    ['own', 'My own', ''],
  ]) {
    const choice = button(label, () => {
      flow.progressDrafts ||= {};
      if (progressChoice) flow.progressDrafts[progressChoice] = flow.evidence;
      progressChoice = flow.progressChoice = key;
      flow.evidence = progress.value = Object.hasOwn(flow.progressDrafts, key)
        ? flow.progressDrafts[key]
        : starter;
      flow.progressDrafts[key] = flow.evidence;
      progress.parentElement.hidden = false;
      syncProgressChoice();
      onChange();
      progress.focus();
    });
    choice.dataset.progressChoice = key;
    progressChoices.append(choice);
  }
  syncProgressChoice();
  goal.insertBefore(progressChoices, progress.parentElement);
  field(
    goal,
    'What is the smallest action that would move that forward?',
    flow.steps[0].action,
    (value) => {
      if (flow.steps[0].action !== value) flow.steps[0].done = false;
      flow.steps[0].action = value;
      onChange();
    },
    { rows: 1, max: 2000 },
  );
  const permission = section('What’s making you hesitate?', 'judgment');
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
        if (!flow.fear.split('\n').includes(label))
          fear.value = flow.fear = [flow.fear, label].filter(Boolean).join('\n');
        if (!flow.permission.split('\n').includes(text))
          allow.value = flow.permission = [flow.permission, text].filter(Boolean).join('\n');
        onChange();
      }),
    );
  permission.insertBefore(fears, fear.parentElement);
  permission.insertBefore(
    node('p', 'field-hint', 'Choose a worry to start with, then adjust the words to fit you.'),
    fears,
  );
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
  }
  renderWarmup();
  const attention = section('What would help protect your attention?', 'attention');
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
    node('h2', '', 'Recovery'),
    node('p', 'focus-break-suggestion', `Suggested break: about ${recovery.minutes} minutes.`),
    node(
      'p',
      'field-hint',
      'A gentle starting point based on your session. Rest for as long as you need.',
    ),
    node('h3', '', 'What would help you recover now?'),
    node(
      'p',
      '',
      'Step away from the screen, get some water or food, move comfortably, or rest quietly. Choose what would help you feel replenished; there is nothing to complete here.',
    ),
    node('h3', '', 'Recognize what happened'),
    node(
      'p',
      '',
      'Notice what you tried, learned, clarified, or moved forward—even if things did not go according to plan. Changing direction, finding a limit, or showing up can count. Give yourself credit for the effort, and leave yourself a kind place to begin again.',
    ),
  );
  check(root, 'Play a celebration effect when I save', recovery.celebrate, (value) => {
    recovery.celebrate = value;
    onChange();
  });
  check(
    root,
    `Start the suggested ${recovery.minutes}-minute break timer after saving`,
    recovery.startTimer,
    (value) => {
      recovery.startTimer = value;
      onChange();
    },
  );
  return root;
}
export function preparationReference(flow, onEdit) {
  const root = node('section', 'focus-preparation-reference');
  root.append(node('h2', '', 'My preparation'));
  const groups = [
    [
      'Challenge–Skill Balance',
      [
        ['Make it compelling', flow.interest],
        ['Make it approachable', flow.access],
      ],
    ],
    ['Clear Goal and Feedback', [['If I get stuck', flow.ifStuck]]],
    [
      'Step Out of Self-Judgment',
      [
        ['What I’m risking', flow.fear],
        ['My permission', flow.permission],
        ['Warm-up attempt', flow.warmupText],
        ['My starting ritual', flow.ritual],
      ],
    ],
    ['Protect Your Attention', [['Parked distractions', flow.parked]]],
  ];
  if (flow.outcome.trim()) groups[1][1].unshift(['Earlier outcome', flow.outcome]);
  if (flow.evidence.trim()) groups[1][1].push(['Progress I want to see', flow.evidence]);
  for (const answer of flow.evidenceExtra || [])
    if (answer.trim()) groups[1][1].push(['Earlier evidence of progress', answer]);
  for (const step of flow.steps)
    if (step.action || step.strategy)
      groups[1][1].push([
        'Earlier next action',
        [step.action, step.strategy].filter(Boolean).join(' — '),
      ]);
  if (flow.readiness)
    groups[0][1].unshift([
      'What helps me engage',
      {
        compelling: 'Make it more compelling',
        manageable: 'Make it more manageable',
        both: 'Make it compelling and manageable',
        ready: 'I’m ready',
      }[flow.readiness],
    ]);
  if (flow.warmup === 'breathing')
    groups[2][1].push([
      'Breathe with intention',
      `Inhale ${flow.breathIn}. Exhale ${flow.breathOut}.`,
    ]);
  if (flow.warmup === 'movement')
    groups[2][1].push([
      'Move into the task',
      'Plant your feet, bring your hands to what you’re working with, and make the first small move.',
    ]);
  if (flow.warmup === 'rehearse')
    groups[2][1].push([
      'Rehearse the first move',
      'Practice the opening action once, then let the next attempt become the task.',
    ]);
  if (flow.warmup === 'rough')
    groups[2][1].push(['Make a low-stakes attempt', 'It can stay imperfect.']);
  const space = {
    dnd: 'Do Not Disturb',
    tabs: 'Distracting tabs closed',
    materials: 'Materials ready',
    people: 'Let others know',
  };
  const selected = Object.keys(space).filter((key) => flow.space[key]);
  if (selected.length)
    groups[3][1].push(['My space', selected.map((key) => space[key]).join(' · ')]);
  let populated = false;
  for (const [title, items] of groups) {
    const filled = items.filter(([, value]) => value?.trim());
    if (!filled.length) continue;
    populated = true;
    const group = node('details', 'focus-reference-group');
    group.open = true;
    group.append(node('summary', '', title));
    for (const [label, value] of filled)
      group.append(node('h4', '', label), node('p', 'focus-reference-answer', value));
    root.append(group);
  }
  if (!populated)
    root.append(
      node('p', 'field-hint', 'Your optional preparation will appear here whenever you add it.'),
    );
  root.append(button(populated ? 'Edit preparation' : 'Need help getting started?', onEdit));
  return root;
}
