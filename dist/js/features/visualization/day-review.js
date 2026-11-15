import { noteTasks } from '../notes/formatting/tasks.js?v=73be664608f3';
import { node } from '../../shared/dom.js?v=73be664608f3';
import { offsetDay, parseDay, timeLabel } from '../../shared/dates.js?v=73be664608f3';
import { freeGaps, suggestedApproach } from './planning-time.js?v=73be664608f3';

const labels = {
  smaller: [
    'Make the day smaller. Pick one essential item and review the rest.',
    'Pick one priority',
  ],
  focus: ['Give one priority a focused block with room for a break.', 'Find a focus block'],
  small: ['Choose a first step that takes 5–10 minutes.', 'Choose a small next step'],
  review: [
    'Work with the time left. Review your remaining commitments and to-dos.',
    'Review what’s left',
  ],
  wrap: ['Wrap up what’s done and decide what belongs on tomorrow’s plan.', 'Review for tomorrow'],
};
const span = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return (
    [hours && `${hours} hr`, remainder && `${remainder} min`].filter(Boolean).join(' ') || '0 min'
  );
};
export const calendarLabel = (day) =>
  parseDay(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const planningTimeLabel = (today, minute, clock) =>
  `${timeLabel(minute % 1440, clock)}${minute >= 1440 ? ` · ${calendarLabel(offsetDay(today, 1))}` : ''}`;

export function buildDayReview({
  today,
  timing,
  notes,
  commitments,
  pending,
  clock,
  state,
  saveState,
  button,
  titleOf,
  isOpen,
  complete,
  update,
  rerender,
}) {
  const panel = node('section', 'meet-day-review');
  const actions = node('div', 'meet-day-review-actions');
  const start = Math.max(timing.start, timing.current);
  const durationOf = (note) =>
    note.focusBlockMinutes ||
    commitments.find((item) => item.id === note.commitmentId)?.minutes ||
    1;
  const gaps = freeGaps(start, timing.end, notes, durationOf);
  const free = gaps.reduce((sum, [from, until]) => sum + until - from, 0);
  const next = notes
    .filter((note) => !note.allDay && !note.done && note.commitmentId && note.minute >= start)
    .sort((a, b) => a.minute - b.minute)[0];
  const nextLabel = next
    ? ` · Next commitment: ${titleOf(next)} at ${planningTimeLabel(today, next.minute, clock)}`
    : '';
  panel.append(
    node(
      'p',
      '',
      timing.remaining
        ? `${span(timing.remaining)} left · ${span(free)} free${nextLabel}`
        : 'Your awake hours have ended.',
    ),
  );
  if (next && start < next.minute) {
    const beforeNext = gaps.reduce(
      (sum, [from, until]) => sum + Math.max(0, Math.min(until, next.minute) - from),
      0,
    );
    panel.append(node('p', 'field-hint', `${span(beforeNext)} free before your next commitment.`));
  }
  const available = notes.filter(isOpen);
  const priorities = [
    ...available.map((note) => ({ key: `note:${note.id}`, title: titleOf(note), note })),
    ...pending
      .filter((item) => !notes.some((note) => note.commitmentId === item.id))
      .map((item) => ({ key: `commitment:${item.id}`, title: item.title, commitment: item })),
  ];
  const pinned = priorities.find(({ key }) => key === state.priority);
  if (pinned) {
    const priority = node('div', 'meet-day-actions');
    priority.append(
      node('strong', '', `Priority · ${pinned.title}`),
      button('Clear priority', () => {
        saveState({ priority: null });
        rerender();
      }),
    );
    panel.append(priority);
  }

  function select(label, options, selected) {
    const field = node('label', 'meet-day-field', label);
    const input = node('select');
    for (const [value, name] of options) {
      const option = node('option', '', name);
      option.value = value;
      if (selected === value) option.setAttribute('selected', '');
      input.append(option);
    }
    field.append(input);
    return { field, input };
  }
  const feelings = node('details');
  feelings.open = !!(state.stress || state.motivation);
  feelings.append(node('summary', '', 'How are you feeling?'));
  for (const name of ['Stress', 'Motivation']) {
    const key = name.toLowerCase();
    const { field, input } = select(
      name,
      [['', 'Skip'], ...['Low', 'Moderate', 'High'].map((value) => [value, value])],
      state[key],
    );
    input.addEventListener('change', () => {
      saveState({ [key]: input.value, approach: null });
      renderApproach();
    });
    feelings.append(field);
  }
  panel.append(feelings, actions);

  function priorityPicker(container, callback) {
    const options = priorities;
    if (!options.length) {
      container.replaceChildren(
        node('p', 'field-hint', 'Add a note or schedule a commitment to choose a priority.'),
      );
      return;
    }
    const { field, input } = select(
      'Priority',
      options.map(({ key, title }) => [key, title]),
      state.priority,
    );
    container.replaceChildren(
      field,
      button(
        'Use this priority',
        () => {
          const item = options.find(({ key }) => key === input.value) || options[0];
          saveState({ priority: item.key });
          callback(item);
        },
        'primary',
      ),
    );
    input.focus();
  }

  function batch(container, items = available, draft = new Map()) {
    const rows = node('div', 'meet-day-queue');
    const tomorrow = offsetDay(today, 1);
    for (const note of items) {
      const destinations = [
        ['keep', 'Keep today'],
        ['tomorrow', 'Move to tomorrow'],
        ['done', 'Mark done'],
      ];
      if (timing.remaining > 0)
        for (const [period, end] of [
          [0, 720],
          [1, 1020],
          [2, timing.end],
        ])
          if (end > start)
            destinations.splice(-1, 0, [
              String(period),
              `Move to ${['morning', 'afternoon', 'evening'][period]}`,
            ]);
      const { field, input } = select(
        state.priority === `note:${note.id}` ? `Priority · ${titleOf(note)}` : titleOf(note),
        destinations,
        draft.get(note),
      );
      input.addEventListener('change', () => draft.set(note, input.value));
      rows.append(field);
    }
    if (!items.length) rows.append(node('p', 'field-hint', 'No unfinished items to review.'));
    const error = node('p', 'field-hint');
    container.replaceChildren(
      rows,
      button(
        'Review changes',
        () => {
          const changes = [...draft].filter(([, value]) => value !== 'keep');
          if (!changes.length) {
            error.textContent = 'Choose an item to move or mark done.';
            return;
          }
          if (changes.some(([note, action]) => action !== 'done' && note.repeat)) {
            error.textContent =
              'Move repeating notes from Daily so you can choose which occurrences to change.';
            return;
          }
          const preview = node('ul');
          const edits = changes.map(([note, action]) => {
            const destination = action === 'tomorrow' ? tomorrow : today;
            const currentDay = note.calendarDay || today;
            const label =
              action === 'done'
                ? 'Mark done'
                : action === 'tomorrow'
                  ? `Move to ${calendarLabel(tomorrow)} · Anytime`
                  : `Move to ${['morning', 'afternoon', 'evening'][Number(action)]} · Anytime`;
            preview.append(node('li', '', `${titleOf(note)} · ${label}`));
            const updated =
              action === 'done'
                ? complete(note)
                : {
                    ...note,
                    allDay: true,
                    minute: [0, 720, 1020][
                      action === 'tomorrow' ? (note.dayPeriod ?? 0) : Number(action)
                    ],
                    dayPeriod: action === 'tomorrow' ? (note.dayPeriod ?? 0) : Number(action),
                    remind: false,
                  };
            return {
              from: currentDay,
              to: action === 'done' ? currentDay : destination,
              before: note,
              after: updated,
            };
          });
          container.replaceChildren(
            preview,
            button(
              'Apply changes',
              () =>
                update(
                  edits,
                  `${edits.length} planning change${edits.length === 1 ? '' : 's'} saved.`,
                ),
              'primary',
            ),
            button('Back', () => batch(container, items, draft)),
          );
          container.querySelector('button').focus();
        },
        'primary',
      ),
      error,
    );
    rows.querySelector('select')?.focus();
  }

  function smallStep(container, item) {
    const input = node('input');
    input.placeholder = 'First step (5–10 minutes)';
    input.setAttribute('aria-label', 'First step');
    input.maxLength = 200;
    const form = node('form', 'meet-day-editor');
    const save = node('button', 'primary', 'Save first step to Daily');
    input.required = true;
    form.append(input, save);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const step = input.value.trim();
      if (!step) return;
      const before = item.note;
      const commitment = item.commitment;
      const day = before?.calendarDay || today;
      const period = timing.current < 720 ? 0 : timing.current < 1020 ? 1 : 2;
      const note = before || {
        id: crypto.randomUUID(),
        title: item.title,
        text: commitment?.body || '',
        tags: commitment?.tags || [],
        commitmentId: commitment?.id,
        allDay: true,
        dayPeriod: period,
        minute: [0, 720, 1020][period],
        task: false,
        done: false,
      };
      const prefix = note.text ? `${note.text}\n` : '';
      update(
        [
          {
            from: day,
            to: day,
            before,
            after: {
              ...note,
              text: `${prefix}${step}`,
              tasks: [
                ...noteTasks(note).filter((task) => task.start < prefix.length),
                { start: prefix.length, done: false },
              ],
              task: false,
            },
          },
        ],
        'First step saved to Daily.',
        before ? null : { priority: `note:${note.id}` },
      );
    });
    container.replaceChildren(form);
    input.focus();
  }

  function focusBlock(container, item) {
    const suitable = gaps.find(([from, until]) => until - from >= 10);
    const tomorrow = offsetDay(today, 1);
    const minute = suitable?.[0] ?? 0;
    const amount = suitable ? Math.min(25, suitable[1] - minute - 5) : 25;
    const day = !suitable || minute >= 1440 ? tomorrow : today;
    const preview = suitable
      ? `${planningTimeLabel(today, minute, clock)} · ${amount} min focus + 5 min break`
      : `${calendarLabel(tomorrow)} · Anytime · ${amount} min focus`;
    container.replaceChildren(
      node('p', '', `${item.title} · ${preview}`),
      button(
        suitable ? 'Add focus block' : 'Plan focus for tomorrow',
        () =>
          update(
            [
              {
                to: day,
                after: {
                  id: crypto.randomUUID(),
                  title: `Focus · ${item.title}`.slice(0, 200),
                  text: '',
                  done: false,
                  task: false,
                  allDay: !suitable,
                  minute: minute % 1440,
                  focusBlockMinutes: amount + (suitable ? 5 : 0),
                },
              },
            ],
            'Focus block added to Daily.',
          ),
        'primary',
      ),
    );
    container.querySelector('button').focus();
  }

  function renderApproach() {
    const kind =
      (Object.hasOwn(labels, state.approach) && state.approach) ||
      suggestedApproach(state.stress, state.motivation, timing.remaining);
    const { field, input } = select(
      'Approach',
      Object.entries(labels).map(([value, [, action]]) => [value, action]),
      kind,
    );
    const editor = node('div', 'meet-day-review-editor');
    input.addEventListener('change', () => {
      saveState({ approach: input.value });
      renderApproach();
      actions.querySelector('select').focus();
    });
    actions.replaceChildren(
      node(
        'p',
        '',
        kind === 'review' && timing.remaining <= 60
          ? 'Choose one thing to finish and review what can move to tomorrow.'
          : labels[kind][0],
      ),
      field,
      button(
        labels[kind][1],
        () => {
          if (kind === 'focus') {
            if (pinned) focusBlock(editor, pinned);
            else priorityPicker(editor, (item) => focusBlock(editor, item));
          } else if (kind === 'small') {
            if (pinned) smallStep(editor, pinned);
            else priorityPicker(editor, (item) => smallStep(editor, item));
          } else if (kind === 'smaller' && priorities.length)
            priorityPicker(editor, () => batch(editor));
          else batch(editor);
        },
        'primary',
      ),
      editor,
    );
  }

  renderApproach();
  const earlier = available.filter((note) => {
    if (!note.allDay) return note.minute + durationOf(note) <= start;
    const end = [720, 1020, timing.end][note.dayPeriod ?? 0];
    return end <= start;
  });
  if (earlier.length) {
    const review = node('details');
    const editor = node('div');
    review.append(node('summary', '', `Unfinished earlier today (${earlier.length})`), editor);
    review.addEventListener('toggle', () => {
      if (review.open && !editor.childElementCount) batch(editor, earlier);
    });
    panel.append(review);
  }
  return panel;
}
