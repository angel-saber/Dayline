import { node as el } from '../../shared/dom.js';
import { weekStart } from '../monthly/weekly-model.js?v=weekly-notes-1';
import {
  dimensions,
  breathingFrame,
  compassTitle,
  compassDates,
} from './model.js?v=weekly-notes-1';
import { activityCatalog, activityFields } from './catalog.js?v=activities-2';
import { dayKey } from '../../shared/schedule.js?v=weekly-notes-1';

const button = (text, fn, cls = 'secondary') => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.onclick = fn;
  return b;
};
export function renderGuidedReports(container, reports = []) {
  for (const report of reports) {
    const details = el('details', 'focus-report guided-report'),
      title = report.activity ? activityCatalog[report.activity].title : 'Guided Planning';
    details.append(
      el(
        'summary',
        '',
        `Guided activity · ${title} · ${new Date(report.completedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
      ),
    );
    const fields = report.activity
      ? activityFields(report.activity)
      : dimensions.map((d) => ({ key: d.key, label: d.label }));
    for (const f of fields)
      if (report.answers[f.key])
        details.append(el('h4', '', f.label), el('p', '', report.answers[f.key]));
    if (report.timer)
      details.append(
        el(
          'p',
          'field-hint',
          report.timer.completed
            ? 'Two-minute action timer completed.'
            : `Action timer: ${Math.floor(report.timer.elapsedMs / 1000)} seconds; continued without completing the timer.`,
        ),
      );
    if (report.schedule) {
      const date = report.schedule.date;
      details.append(
        el('h4', '', 'Weekly notes'),
        el(
          'p',
          '',
          `${compassTitle(date)}\n${report.schedule.mode === 'weekly' ? 'Weekly Notes: ' + compassDates(date).map(weekStart).join(' · ') : compassDates(date).join(' · ') + ' at ' + report.schedule.time}`,
        ),
      );
    }
    container.append(details);
  }
}
export function setupActivities({ root, savePlan, onSaved }) {
  const dialog = el('dialog', 'activity-dialog');
  dialog.setAttribute('aria-labelledby', 'activity-heading');
  document.body.append(dialog);
  const drafts = new Map();
  let answers = {},
    step = 0,
    reportId = null,
    frame = null,
    started = 0,
    mode = 'calm',
    pausedAt = null,
    pauseStarted = null,
    pauseAction = null;
  function stop() {
    pauseAction?.();
    pauseAction = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  dialog.addEventListener('close', stop);
  window.addEventListener('dayline:account', () => {
    stop();
    dialog.close();
    answers = {};
    step = 0;
    reportId = null;
    drafts.clear();
  });
  function shell(title) {
    stop();
    dialog.replaceChildren();
    const header = el('div', 'activity-header'),
      heading = el('h2', '', title);
    heading.id = 'activity-heading';
    heading.tabIndex = -1;
    queueMicrotask(() => {
      if (dialog.open) heading.focus();
    });
    header.append(
      heading,
      button('Close', () => dialog.close()),
    );
    dialog.append(header);
  }
  function open() {
    if (!dialog.open) dialog.showModal();
  }
  function breathe() {
    shell('Guided Breathing');
    dialog.append(
      el(
        'p',
        '',
        'Choose a two-minute rhythm. Breathe comfortably, without holding your breath or forcing it. You can stop at any time.',
      ),
    );
    const options = el('div', 'activity-options');
    options.append(
      button('Calm · 4 seconds in, 6 out', () => runBreathing('calm'), 'primary'),
      button('Energize · 3 seconds in, 3 out', () => runBreathing('energize')),
    );
    dialog.append(
      options,
      el(
        'p',
        'field-hint',
        'For the energizing rhythm, sit upright and let your attention wake up gently. If you feel dizzy or uncomfortable, stop and return to your natural breathing.',
      ),
    );
    open();
  }
  function runBreathing(choice) {
    mode = choice;
    shell(choice === 'calm' ? 'A calmer rhythm' : 'A fresh start');
    started = performance.now();
    pausedAt = null;
    const graphic = el('div', 'breath-graphic'),
      orb = el('div', 'breath-orb');
    graphic.setAttribute('aria-hidden', 'true');
    graphic.append(orb);
    const instruction = el('p', 'breath-instruction'),
      timer = el('p', 'breath-timer'),
      status = el('p', 'sr-only');
    status.setAttribute('role', 'status');
    const pause = button('Pause', () => {
      if (pausedAt === null) {
        pausedAt = performance.now();
        pauseStarted = pausedAt;
        pause.textContent = 'Resume';
      } else {
        started += performance.now() - pauseStarted;
        pausedAt = null;
        pause.textContent = 'Pause';
      }
    });
    dialog.append(
      graphic,
      instruction,
      timer,
      status,
      pause,
      button('Choose another rhythm', breathe),
    );
    let previous = '';
    function tick() {
      const state = breathingFrame((pausedAt ?? performance.now()) - started, mode);
      instruction.textContent = state.instruction;
      timer.textContent = `${Math.floor(state.remaining / 60)}:${String(state.remaining % 60).padStart(2, '0')} remaining`;
      orb.style.setProperty('--breath-scale', String(0.65 + state.expansion * 0.35));
      if (state.instruction !== previous) {
        status.textContent = state.instruction;
        previous = state.instruction;
      }
      if (state.done) {
        pause.remove();
        dialog.append(
          el(
            'p',
            '',
            'Two minutes complete. Notice how you feel, then choose one small next step.',
          ),
          button('Done', () => dialog.close(), 'primary'),
        );
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    tick();
  }
  function plan() {
    shell('Guided Planning');
    const d = dimensions[step];
    dialog.append(
      el('p', 'field-hint', `Step ${step + 1} of 5 · ${d.label}`),
      el(
        'p',
        '',
        'One small activity is enough. These are possibilities for today, not a test or a list you must finish.',
      ),
    );
    const label = el('label', 'planning-question', d.question),
      input = el('textarea', 'planning-answer');
    input.id = 'activity-answer';
    input.maxLength = 2000;
    input.rows = 4;
    input.value = answers[d.key] || '';
    label.htmlFor = input.id;
    const error = el('p', 'activity-error');
    error.setAttribute('role', 'alert');
    input.oninput = () => {
      answers[d.key] = input.value;
      error.textContent = '';
    };
    dialog.append(label, el('p', 'field-hint', d.hint), input, error);
    const controls = el('div', 'inline');
    if (step)
      controls.append(
        button('Back', () => {
          step--;
          plan();
        }),
      );
    controls.append(
      button(
        step === 4 ? 'Review my plan' : 'Next',
        () => {
          if (!input.value.trim()) {
            error.textContent = 'Write one small activity to continue.';
            input.focus();
            return;
          }
          answers[d.key] = input.value.trim();
          step++;
          if (step === 5) review();
          else plan();
        },
        'primary',
      ),
    );
    dialog.append(
      controls,
      el(
        'p',
        'field-hint',
        'Your answers stay here while this page is open. They are saved to your notes when you finish.',
      ),
    );
    open();
    input.focus();
  }
  function review() {
    shell('Five small ways forward');
    for (const d of dimensions)
      dialog.append(el('h3', '', d.label), el('p', 'activity-answer-preview', answers[d.key]));
    const status = el(
      'p',
      'field-hint',
      'Save this as an expandable guided activity in today’s current time interval. Your existing note stays intact.',
    );
    status.setAttribute('role', 'status');
    const controls = el('div', 'inline'),
      save = button(
        'Save to current interval',
        () => {
          reportId ??= crypto.randomUUID();
          const report = { id: reportId, completedAt: Date.now(), answers: { ...answers } };
          save.disabled = true;
          const result = savePlan(report);
          save.disabled = false;
          if (!result) {
            status.textContent =
              'Could not save. Your answers are still here. Try again or download a backup from Settings.';
            return;
          }
          answers = {};
          step = 0;
          reportId = null;
          shell('Your plan is saved');
          dialog.append(
            el(
              'p',
              '',
              'Five small activities, one place to return to. Choose whichever feels right to start.',
            ),
            button(
              'View my note',
              () => {
                dialog.close();
                onSaved(result);
              },
              'primary',
            ),
            button('Done', () => dialog.close()),
          );
        },
        'primary',
      );
    controls.append(
      button('Back', () => {
        step = 4;
        plan();
      }),
      save,
    );
    dialog.append(status, controls);
  }
  function launchActivity(type) {
    if (!drafts.has(type))
      drafts.set(type, {
        answers: {},
        step: 0,
        id: crypto.randomUUID(),
        schedule: false,
        timer: null,
      });
    const draft = drafts.get(type),
      activity = activityCatalog[type];
    function fieldControls(field, container) {
      const label = el('label', 'planning-question', field.label),
        input = el('textarea', 'planning-answer');
      input.id = 'guided-' + field.key.replaceAll('.', '-');
      input.rows = field.key.endsWith('.project') ? 2 : 3;
      input.maxLength = 2000;
      input.value = draft.answers[field.key] || '';
      label.htmlFor = input.id;
      input.oninput = () => {
        draft.answers[field.key] = input.value;
      };
      container.append(label);
      if (field.hint) container.append(el('p', 'field-hint', field.hint));
      container.append(input);
      return input;
    }
    function screen() {
      const segment = activity.steps[draft.step];
      if (!segment) {
        reviewActivity();
        return;
      }
      shell(activity.title);
      dialog.append(
        el(
          'p',
          'field-hint',
          `Step ${draft.step + 1} of ${activity.steps.length} · ${segment.title}`,
        ),
      );
      if (segment.timer) {
        timerScreen();
        open();
        return;
      }
      if (type === 'compass')
        dialog.append(
          el(
            'p',
            'field-hint',
            'Work backward from the finished project. Choose one achievable task per week; week four should complete the outcome.',
          ),
        );
      const controls = segment.fields.map((f) => [f, fieldControls(f, dialog)]),
        error = el('p', 'activity-error');
      error.setAttribute('role', 'alert');
      dialog.append(error);
      const nav = el('div', 'inline');
      if (draft.step)
        nav.append(
          button('Back', () => {
            draft.step--;
            screen();
          }),
        );
      nav.append(
        button(
          draft.step === activity.steps.length - 1 ? 'Review activity' : 'Next',
          () => {
            for (const [f, input] of controls) {
              draft.answers[f.key] = input.value.trim();
              if (!f.optional && !draft.answers[f.key]) {
                error.textContent = 'Write a small, concrete answer to continue.';
                input.focus();
                return;
              }
            }
            if (
              type === 'untangle' &&
              draft.step === 1 &&
              !['act', 'ask', 'later'].some((k) => draft.answers[k]?.trim())
            ) {
              error.textContent = 'Place at least one thought in Act, Ask, or Later.';
              return;
            }
            draft.step++;
            screen();
          },
          'primary',
        ),
      );
      dialog.append(
        nav,
        el(
          'p',
          'field-hint',
          'Your draft stays here while this page is open. Finish and save to record it in your notes.',
        ),
      );
      open();
    }
    function timerScreen() {
      dialog.append(el('p', 'activity-answer-preview', draft.answers.action));
      const timer = el('p', 'breath-instruction'),
        hint = el('p', 'field-hint'),
        controls = el('div', 'inline');
      dialog.append(timer, hint, controls);
      const elapsed = () =>
        draft.timer
          ? Math.min(
              120000,
              draft.timer.elapsed +
                (draft.timer.started === null ? 0 : performance.now() - draft.timer.started),
            )
          : 0;
      pauseAction = () => {
        if (draft.timer) {
          draft.timer.elapsed = elapsed();
          draft.timer.started = null;
        }
      };
      const toggle = button('Start two minutes', () => {
        if (!draft.timer) draft.timer = { elapsed: 0, started: performance.now() };
        else if (draft.timer.started === null) draft.timer.started = performance.now();
        else {
          draft.timer.elapsed = elapsed();
          draft.timer.started = null;
        }
        update();
      });
      const next = button('Continue without timer', () => {
        draft.timer = { elapsed: elapsed(), started: null };
        draft.step++;
        screen();
      });
      controls.append(
        toggle,
        next,
        button('Back', () => {
          if (draft.timer) {
            draft.timer.elapsed = elapsed();
            draft.timer.started = null;
          }
          draft.step--;
          screen();
        }),
      );
      function update() {
        const used = elapsed(),
          left = Math.ceil((120000 - used) / 1000);
        timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        hint.textContent =
          used >= 120000
            ? 'Two minutes complete. You can stop here or keep going.'
            : 'Try the tiny action you chose. You can pause or continue to reflection whenever you need.';
        toggle.textContent = !draft.timer
          ? 'Start two minutes'
          : draft.timer.started === null
            ? 'Resume'
            : 'Pause';
        toggle.hidden = used >= 120000;
        next.textContent = used >= 120000 ? 'Reflect on my start' : 'Continue to reflection';
        frame = requestAnimationFrame(update);
      }
      update();
    }
    function reviewActivity() {
      shell(activity.title + ' · Review');
      for (const f of activityFields(type))
        if (draft.answers[f.key])
          dialog.append(
            el('h3', '', f.label),
            el('p', 'activity-answer-preview', draft.answers[f.key]),
          );
      const status = el(
        'p',
        'field-hint',
        'Save an expandable guided activity report to today’s current interval.',
      );
      status.setAttribute('role', 'status');
      if (type === 'compass') {
        const option = el('label', 'compass-populate'),
          check = el('input');
        check.type = 'checkbox';
        check.checked = draft.schedule;
        check.onchange = () => {
          draft.schedule = check.checked;
        };
        option.append(check, document.createTextNode(' Add four undated Weekly Notes to Monthly'));
        const preview = el('p', 'field-hint');
        const today = dayKey();
        preview.textContent = `${compassTitle(today)}. Weeks beginning ${compassDates(today).map(weekStart).join(', ')}. Each Weekly Note includes that week’s five checkbox tasks, with no assigned day, time, or reminder. Schedule individual notes later when you’re ready. Existing notes are kept.`;
        dialog.append(option, preview);
      }
      dialog.append(status);
      const nav = el('div', 'inline');
      nav.append(
        button('Back', () => {
          draft.step = activity.steps.length - 1;
          screen();
        }),
        button(
          'Finish and save report',
          () => {
            const report = {
              id: draft.id,
              activity: type,
              completedAt: Date.now(),
              answers: { ...draft.answers },
            };
            if (type === 'compass' && draft.schedule) report.schedule = { mode: 'weekly' };
            if (type === 'two-minute') {
              const elapsed = draft.timer?.elapsed || 0;
              report.timer = { elapsedMs: Math.min(120000, elapsed), completed: elapsed >= 120000 };
            }
            const result = savePlan(report);
            if (!result) {
              status.textContent = 'Could not save. Your draft is still here. Please try again.';
              return;
            }
            drafts.delete(type);
            shell('Activity recorded');
            dialog.append(
              el(
                'p',
                '',
                report.schedule
                  ? 'Your report and all four Weekly Notes are saved.'
                  : 'Your guided activity report is saved in the current interval.',
              ),
              button(
                'View my report',
                () => {
                  dialog.close();
                  onSaved(result);
                },
                'primary',
              ),
              button('Done', () => dialog.close()),
            );
          },
          'primary',
        ),
      );
      dialog.append(nav);
      open();
    }
    screen();
  }
  root.append(el('div', 'eyebrow', 'A LITTLE HELP GETTING STARTED'));
  const title = el('h1', '', 'Find your next step.');
  title.id = 'more-heading';
  root.append(
    title,
    el(
      'p',
      'intro',
      'Feeling anxious, low on energy, overwhelmed, or unsure where to begin? Take a moment, then make a little room for progress.',
    ),
  );
  for (const [title, copy, action, label] of [
    [
      'Guided Breathing',
      'Follow a gentle two-minute animation to settle down or wake up your attention.',
      breathe,
      'Choose a breathing exercise',
    ],
    [
      'Guided Planning',
      'Choose one small activity for today across work, health, learning, relationships, and spirituality.',
      () => {
        if (step === 5) review();
        else plan();
        open();
      },
      'Start guided planning',
    ],
  ]) {
    const card = el('section', 'settings-card activity-card');
    card.append(el('h2', '', title), el('p', 'field-hint', copy), button(label, action, 'primary'));
    root.append(card);
  }
  for (const [type, activity] of Object.entries(activityCatalog)) {
    const card = el('section', 'settings-card activity-card');
    card.append(
      el('h2', '', activity.title),
      el('p', 'field-hint', activity.description),
      button('Start ' + activity.title, () => launchActivity(type), 'primary'),
    );
    root.append(card);
  }
}
