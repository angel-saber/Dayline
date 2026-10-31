import {
  compactFlow,
  createFlowPreparation,
  recoverySection,
  refreshOutcomeCategories,
} from './flow-view.js?v=f99b8ac250a9';
import { newFlow, newRecovery, nextAction } from './flow-model.js?v=f99b8ac250a9';
import { setupBreakTimer } from './break-timer.js?v=f99b8ac250a9';
import { chooseRepeatScope } from '../repeating/scope.js?v=f99b8ac250a9';
import { node } from '../../shared/dom.js?v=f99b8ac250a9';
import { indentLevel } from '../notes/formatting/indents.js?v=f99b8ac250a9';
import { attachmentList, bindFileDrop } from '../attachments/attachments.js?v=f99b8ac250a9';
import { tagBadges, categoryOptions, noteTags } from '../notes/note-types.js?v=f99b8ac250a9';
import { voice, focusMantras, focusIdeas } from '../../personalities/index.js?v=f99b8ac250a9';
import { dayKey, timeLabel, bucket } from '../../shared/schedule.js?v=f99b8ac250a9';
import {
  focusIntervalNotes,
  newFocus,
  advanceFocus,
  commitFocus,
  findFocusNote,
  validFocusDraft,
  durationLabel,
  MANTRAS,
  INSPIRATION,
} from './model.js?v=f99b8ac250a9';
import { createNoteEditor } from '../notes/note-editor.js?v=f99b8ac250a9';
import { renderFormatted } from '../notes/formatting/format.js?v=f99b8ac250a9';
import { noteTasks } from '../notes/formatting/tasks.js?v=f99b8ac250a9';
const KEY = 'dayline.focus.v1';

const button = (text, action, className = 'secondary') => {
  const el = node('button', className, text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
export function setupFocus(api) {
  const owner = crypto.randomUUID(),
    launch = document.querySelector('#launch-focus');
  const dialog = node('dialog', 'focus-window');
  dialog.setAttribute('aria-label', 'Dayline Focus Mode');
  document.body.append(dialog);
  const mini = button('', () => open(), 'focus-mini');
  mini.hidden = true;
  document.body.append(mini);
  let flowOpen = false,
    flowView = null;
  const breakTimer = setupBreakTimer({
    canShow: () => !document.querySelector('#planner')?.hidden,
  });
  let notesSignature = '',
    session = null,
    noteEditor = null,
    error = '',
    unreadable = false,
    transition = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) session = validFocusDraft(JSON.parse(raw));
  } catch {
    unreadable = true;
  }
  function save(claim = false) {
    if (!session) return true;
    try {
      const raw = localStorage.getItem(KEY),
        other = raw && JSON.parse(raw);
      if (!claim && other && other.owner !== owner) {
        error = 'This session is open in another tab. Resume here to take over.';
        status();
        return false;
      }
      session.owner = owner;
      localStorage.setItem(KEY, JSON.stringify(validFocusDraft(structuredClone(session))));
      error = '';
      status();
      return true;
    } catch {
      error =
        'Your browser could not save this session draft. Keep this tab open and try saving again.';
      status();
      return false;
    }
  }
  function status() {
    dialog.querySelector('.focus-save-status')?.replaceChildren(document.createTextNode(error));
  }
  let lastPhase;
  function buttons() {
    const phase = session?.phase || 'closed';
    if (phase !== lastPhase) {
      lastPhase = phase;
      window.dispatchEvent(new CustomEvent('dayline:focus-state', { detail: { phase } }));
    }
    launch.hidden = !!session;
    launch.textContent = unreadable ? 'Recover Focus draft' : 'Launch Focus Mode';
    mini.hidden = !session || dialog.open;
    if (session) {
      const elapsed = session.startedAt
        ? durationLabel((session.endedAt || Date.now()) - session.startedAt)
        : 'Ready when you are';
      mini.textContent = `${session.phase === 'reflect' ? 'Finish reflection' : 'Return to Focus'}${session.flow?.hideClock && session.phase === 'active' ? '' : ' · ' + elapsed}`;
    }
  }
  function page() {
    return session.pages[session.viewIndex];
  }
  function resolve(p = page()) {
    return findFocusNote(api.getState().days, p.noteId, p.date);
  }
  function flushNote() {
    if (noteEditor) {
      noteEditor.flush();
      noteEditor.destroy();
      noteEditor = null;
    }
  }
  function base(title) {
    flowView?.destroy();
    flowView = null;
    flushNote();
    dialog.replaceChildren();
    const header = node('div', 'focus-window-header'),
      heading = node('h1', '', title);
    heading.tabIndex = -1;
    header.append(
      node('span', 'eyebrow', 'DAYLINE · FOCUS MODE'),
      button('Shortcuts', () => api.openShortcuts?.(), 'secondary focus-open-shortcuts'),
      button('Open Focus Audio', () => api.openAudio(), 'secondary focus-open-audio'),
      button('Minimize', minimize, 'focus-minimize'),
    );
    dialog.append(header, heading, node('p', 'focus-save-status', error));
    dialog.querySelector('.focus-save-status').setAttribute('role', 'status');
  }
  function minimize() {
    flowView?.destroy();
    flowView = null;
    flushNote();
    if (session && session.owner === owner) save();
    dialog.close();
    buttons();
    api.refresh();
  }
  function refreshPageSnapshot(p = page()) {
    const choices = focusIntervalNotes(api.getState(), p);
    const entry =
      choices.find((e) => e.id === p.noteId) || choices.find((e) => !e.done) || choices[0];
    if (entry) {
      p.title = entry.title || '';
      p.text = entry.text;
      p.noteId = entry.id;
    } else if (p === session.pages.at(-1)) {
      p.title = '';
      p.text = '';
      p.noteId = null;
    } else {
      const found = resolve(p);
      if (found) {
        p.title = found.entry.title || '';
        p.text = found.entry.text;
      }
    }
  }
  function editNote(host, entry = null, repeatScope = null) {
    if (entry?.repeat && !repeatScope) {
      chooseRepeatScope('Edit', (choice) => editNote(host, entry, choice));
      return;
    }
    const switching = !!noteEditor;
    flushNote();
    if (switching) {
      dialog.querySelector('.focus-notes-section')?.replaceWith(noteSection());
      host = entry
        ? dialog.querySelector(`[data-note-id="${CSS.escape(entry.id)}"] .focus-note`)
        : dialog.querySelector('.focus-add-note');
      if (!host) {
        api.toast('This note has moved or is no longer available in this interval.');
        return;
      }
    }
    const p = page(),
      found = entry ? findFocusNote(api.getState().days, entry.id, p.date) : null;
    if (entry && !found) {
      render();
      api.toast('This note is no longer available.');
      return;
    }
    entry = found?.entry || null;
    if (!host.isConnected) {
      host = entry
        ? dialog.querySelector(`[data-note-id="${CSS.escape(entry.id)}"] .focus-note`)
        : dialog.querySelector('.focus-add-note');
      if (!host) return;
    }
    const date = found?.date || p.date;
    let id = entry?.id || null;
    noteEditor = createNoteEditor({
      entry,
      categories: categoryOptions(api.getState().days, api.getState().settings.tags),
      minute: p.minute,
      label: 'Focus interval note',
      onDuplicate: () => id && api.duplicateNote?.(date, id),
      onChange(values) {
        const result = api.editNote(date, id, p.minute, values, repeatScope || 'one');
        if (result) {
          id = result.id;
          p.noteId = id;
          p.title = values.title;
          p.text = values.text;
          save();
        }
        return !!result;
      },
      onDone() {
        flushNote();
        dialog.querySelector('.focus-notes-section')?.replaceWith(noteSection());
      },
    });
    host.replaceChildren(noteEditor.element);
    noteEditor.focus();
    return noteEditor;
  }
  function noteSignature() {
    const p = page();
    return JSON.stringify({
      page: p.key,
      clock: api.getState().settings.clock,
      entries: focusIntervalNotes(api.getState(), p),
    });
  }
  function noteSection() {
    refreshPageSnapshot();
    const p = page(),
      choices = focusIntervalNotes(api.getState(), p);
    const section = node('section', 'focus-section focus-notes-section'),
      heading = node('div', 'focus-section-heading');
    const addHost = node('div', 'focus-add-note');
    heading.append(
      node('h2', '', voice('focus.noteHeading')),
      button('Add a note', () => editNote(addHost)),
    );
    section.append(
      heading,
      node(
        'p',
        'focus-interval-label',
        `${p.date} · ${timeLabel(p.minute, api.getState().settings.clock)} – ${timeLabel(Math.min(1440, p.minute + (p.interval || session.interval)), api.getState().settings.clock)}`,
      ),
    );
    if (choices.length > 1)
      section.append(
        node(
          'p',
          'field-hint',
          'All notes in this interval. Choose which note receives the session summary.',
        ),
      );
    for (const entry of choices) {
      const card = node(
          'article',
          `focus-note-card${entry.id === p.noteId ? ' selected-focus-note' : ''}`,
        ),
        body = node('div', 'focus-note'),
        tools = node('div', 'focus-note-actions');
      card.dataset.noteId = entry.id;
      const badge = tagBadges(entry);
      if (badge) card.append(badge);
      card.append(
        node('p', 'focus-interval-label', timeLabel(entry.minute, api.getState().settings.clock)),
      );
      if (entry.title) body.append(node('h3', '', entry.title));
      let start = 0;
      for (const line of entry.text.split('\n')) {
        const row = node('div', 'note-line');
        row.style.setProperty('--indent-level', indentLevel(entry.indents, start));
        const task = noteTasks(entry).find((t) => t.start === start),
          anchor = start;
        if (task) {
          const check = node('input', 'line-checkbox');
          check.type = 'checkbox';
          check.checked = task.done;
          check.setAttribute('aria-label', `Complete focus task: ${line}`);
          check.addEventListener('change', () => {
            api.checkTask(p.date, entry.id, anchor);
            refreshPageSnapshot();
            render();
          });
          row.append(check);
        }
        if (!task && entry.bullets?.some((item) => item.start === start)) {
          const marker = node('span', 'bullet-marker', '•');
          marker.setAttribute('aria-hidden', 'true');
          row.append(marker);
        }
        const text = node('span', 'note-text');
        const marks = (entry.format || [])
          .filter((m) => m.start < start + line.length && m.end > start)
          .map((m) => ({
            ...m,
            start: Math.max(0, m.start - start),
            end: Math.min(line.length, m.end - start),
          }));
        renderFormatted(text, line || '\u200b', marks);
        text.classList.toggle('task-completed', !!task?.done);
        row.append(text);
        body.append(row);
        start += line.length + 1;
      }
      card.tabIndex = 0;
      card.setAttribute('role', 'group');
      card.setAttribute(
        'aria-label',
        `Note: ${entry.title || entry.text.split('\n')[0] || 'Untitled note'}. Press Enter to edit.`,
      );
      card.addEventListener('click', (event) => {
        if (event.target.closest('.editor,button,input,select,textarea,a,details,summary')) return;
        editNote(body, entry);
      });
      card.addEventListener('keydown', (event) => {
        if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          editNote(body, entry);
        }
      });

      if (choices.length > 1) {
        const choose = button(
          entry.id === p.noteId ? 'Session summary note' : 'Use for session summary',
          () => {
            flushNote();
            p.noteId = entry.id;
            refreshPageSnapshot();
            save();
            render();
          },
        );
        choose.setAttribute('aria-pressed', String(entry.id === p.noteId));
        tools.append(choose);
      }
      body.append(attachmentList(entry.attachments));
      bindFileDrop(card, (files) => editNote(body, entry)?.attachFiles(files));
      card.append(body);
      if (tools.childNodes.length) card.append(tools);
      section.append(card);
    }
    if (!choices.length)
      section.append(
        node(
          'p',
          'field-hint',
          p.text
            ? `Earlier note: ${p.title || p.text}`
            : 'No note is planned for this interval yet. You can add one here.',
        ),
      );
    section.append(addHost);
    notesSignature = noteSignature();
    return section;
  }
  function refreshNotes() {
    syncOutcomeTags();
    if (!session || !dialog.open || transition || noteEditor || session.phase === 'reflect') return;
    const signature = noteSignature();
    if (signature === notesSignature) return;
    const section = dialog.querySelector('.focus-notes-section');
    if (section) {
      section.replaceWith(noteSection());
      if (session.owner === owner) save();
    }
  }
  function flow() {
    if (!session.flow) session.flow = newFlow(noteTags(resolve()?.entry || {}));
    return session.flow;
  }
  let syncingOutcome = false;
  function syncOutcomeTags() {
    if (!session || session.phase === 'reflect' || syncingOutcome) return;
    const found = resolve();
    if (!found) return;
    const tags = noteTags(found.entry);
    if (JSON.stringify(flow().tags) !== JSON.stringify(tags)) {
      flow().tags = [...tags];
      noteEditor?.setTags(tags);
      refreshOutcomeCategories(dialog);
      if (session.owner === owner) save();
    }
  }
  function changeOutcomeTags(tags) {
    const found = resolve();
    if (!found) return true;
    syncingOutcome = true;
    try {
      noteEditor?.flush();
      if (api.setFocusTags?.(found.date, found.entry.id, tags) === false) {
        api.toast('Could not save the note categories. Your previous categories were kept.');
        return false;
      }
      noteEditor?.setTags(tags);
      return true;
    } finally {
      syncingOutcome = false;
    }
  }
  function categories() {
    return categoryOptions(api.getState().days, api.getState().settings.tags);
  }
  function beginFocus() {
    const mantra = dialog.querySelector('.focus-mantra-input');
    if (!session.mantra.trim()) {
      mantra?.setCustomValidity('Choose or write a mantra first.');
      mantra?.reportValidity();
      api.toast('Choose or write a commitment mantra first.');
      return;
    }
    mantra?.setCustomValidity('');
    flowView?.destroy();
    flowView = null;
    flushNote();
    commitFocus(session, api.getState(), Date.now());
    breakTimer.stop();
    flowOpen = false;
    const committed = save();
    transition = true;
    dialog.classList.add('focus-committing');
    dialog.querySelectorAll('button').forEach((b) => (b.disabled = true));
    setTimeout(() => {
      transition = false;
      dialog.classList.remove('focus-committing');
      if (session && dialog.open) render();
      if (committed && session?.phase === 'active')
        window.dispatchEvent(
          new CustomEvent('dayline:effect', { detail: { kind: 'focus-commit' } }),
        );
    }, 1100);
  }
  function extendedPreparation() {
    base('Access Flow State for the Task');
    flowView = createFlowPreparation({
      flow: flow(),
      categories: categories(),
      onChange: save,
      onTagsChange: changeOutcomeTags,
      onBack() {
        flowOpen = false;
        render();
      },
      onBegin: beginFocus,
      onAudio: () => api.openAudio(),
      onSaveWarmup(text) {
        const found = resolve(),
          current = found?.entry;
        const result = api.editNote(
          found?.date || page().date,
          current?.id || null,
          page().minute,
          {
            ...(current || {
              title: 'Focus warm-up',
              minute: page().minute,
              format: [],
              tasks: [],
              bullets: [],
              indents: [],
              tags: [],
              attachments: [],
            }),
            tasks: noteTasks(current),
            text: [current?.text, text].filter(Boolean).join('\n\n'),
          },
          'one',
        );
        if (!result) return false;
        page().noteId = result.id;
        refreshPageSnapshot();
        return true;
      },
    });
    dialog.append(flowView.element);
  }
  function prepare() {
    base(voice('focus.preparationHeading'));
    const fields = node('div', 'focus-prep-fields');
    fields.append(node('p', 'focus-lead', voice('focus.preparationIntro')), noteSection());
    for (const [title, copy] of [
      [voice('focus.overwhelmedHeading'), voice('focus.overwhelmedAdvice')],
      [voice('focus.confusedHeading'), voice('focus.confusedAdvice')],
    ]) {
      const details = node('details', 'focus-advice');
      details.append(node('summary', '', title), node('p', '', copy));
      fields.append(details);
    }
    fields.append(
      button('Need more help getting started?', () => {
        noteEditor?.flush();
        flowOpen = true;
        render();
      }),
      compactFlow(flow(), {
        onChange: save,
        categories: categories(),
        onTagsChange: changeOutcomeTags,
      }),
    );
    const commitment = node('section', 'focus-commitment');
    commitment.append(node('h2', '', voice('focus.commitmentHeading')));
    const mantra = node('textarea', 'focus-mantra-input');
    mantra.rows = 3;
    mantra.value = session.mantra;
    mantra.setAttribute('aria-label', 'Commitment mantra');
    mantra.addEventListener('input', () => {
      mantra.setCustomValidity('');
      session.mantra = mantra.value;
      save();
    });
    const controls = node('div', 'inline');
    controls.append(
      button('Reshuffle mantra', () => {
        const pool = focusMantras(MANTRAS);
        let next = pool[Math.floor(Math.random() * pool.length)];
        if (next === session.mantra) next = pool[(pool.indexOf(next) + 1) % pool.length];
        session.mantra = next;
        mantra.value = next;
        save();
      }),
      button('Commit', beginFocus, 'primary'),
    );
    commitment.append(
      mantra,
      node('small', 'field-hint', 'Keep this mantra, reshuffle it, or write your own.'),
      controls,
    );
    fields.append(
      button(
        'Cancel preparation',
        () => {
          clear();
          dialog.close();
          buttons();
        },
        'text-button',
      ),
    );
    dialog.append(fields, commitment);
  }
  function active() {
    base(voice('focus.activeHeading'));
    dialog.append(node('p', 'focus-mantra', session.mantra));
    const nextMove = node('p', 'focus-next-move');
    const updateNext = () => {
      nextMove.textContent = nextAction(flow());
      save();
    };
    nextMove.textContent = nextAction(flow());
    const preparation = node('details', 'focus-session-preparation');
    preparation.append(
      node('summary', '', 'Preparation & next action'),
      compactFlow(flow(), {
        onChange: updateNext,
        categories: categories(),
        onTagsChange: changeOutcomeTags,
      }),
    );
    dialog.append(nextMove, preparation);

    const stats = node('div', 'focus-stats');
    stats.append(node('span', 'focus-elapsed'), node('span', 'focus-live-position'));
    const clockToggle = button(
      flow().hideClock ? 'Show session clock' : 'Hide session clock',
      () => {
        flow().hideClock = !flow().hideClock;
        clockToggle.textContent = flow().hideClock ? 'Show session clock' : 'Hide session clock';
        save();
        tickLabels();
      },
    );
    stats.append(clockToggle);
    dialog.append(stats);
    const pages = node('div', 'focus-page-nav');
    const previous = button('← Previous interval', () => {
        flushNote();
        session.viewIndex--;
        save();
        render();
      }),
      next = button('Next interval →', () => {
        flushNote();
        session.viewIndex++;
        save();
        render();
      });
    previous.disabled = session.viewIndex === 0;
    next.disabled = session.viewIndex === session.pages.length - 1;
    pages.append(
      previous,
      node('span', '', `${session.viewIndex + 1} / ${session.pages.length}`),
      next,
    );
    if (session.viewIndex !== session.pages.length - 1)
      pages.append(
        button('Return to current interval', () => {
          flushNote();
          session.viewIndex = session.pages.length - 1;
          save();
          render();
        }),
      );
    dialog.append(pages, noteSection());
    const found = resolve(),
      current = session.pages.at(-1);
    if (
      session.viewIndex < session.pages.length - 1 &&
      found &&
      !found.entry.done &&
      current.noteId !== page().noteId
    ) {
      const extend = node('div', 'focus-extend');
      extend.append(
        node(
          'p',
          'field-hint',
          'Continue this unfinished note in the current interval. That interval’s existing notes move together to the next empty slot.',
        ),
        button('Continue this note in current interval', () => {
          flushNote();
          if (
            api.extendNote(
              page().noteId,
              page().date,
              current.date,
              current.minute,
              session.interval,
            )
          ) {
            current.noteId = page().noteId;
            session.viewIndex = session.pages.length - 1;
            refreshPageSnapshot();
            save();
            render();
          }
        }),
      );
      dialog.append(extend);
    }
    const inspiration = node('section', 'focus-section');
    inspiration.append(
      node('h2', '', voice('focus.inspirationHeading')),
      node('p', 'focus-inspiration'),
      node('small', 'field-hint', voice('focus.inspirationHint')),
    );
    const quickActivities = node('div', 'focus-activity-shortcuts');
    quickActivities.setAttribute('aria-label', 'More activities');
    for (const { id, title } of api.moreActivities?.() || []) {
      const quick = button(title, () => {
        noteEditor?.flush();
        api.openMoreActivity?.(id);
      });
      quick.dataset.moreActivity = id;
      quickActivities.append(quick);
    }
    inspiration.append(quickActivities);
    dialog.append(inspiration);
    const interruptions = node('section', 'focus-section');
    interruptions.append(
      node('h2', '', 'Interruption log'),
      node('p', 'field-hint', voice('focus.interruptionHint')),
    );
    if (flow().parked.trim()) {
      const before = node('details', 'focus-before-starting');
      before.append(
        node('summary', '', 'Before starting'),
        node('p', 'yearly-copy', flow().parked),
      );
      interruptions.append(before);
    }
    const log = node('textarea', 'focus-log-input');
    log.rows = 5;
    log.placeholder = voice('focus.interruptionPlaceholder');
    log.value = page().log;
    log.setAttribute(
      'aria-label',
      'Interruption log for ' + page().date + ' ' + timeLabel(page().minute),
    );
    const p = page();
    log.addEventListener('input', () => {
      p.log = log.value;
      save();
    });
    interruptions.append(log);
    dialog.append(interruptions, button('Finish session', finish, 'primary focus-finish'));
    tickLabels();
  }
  function finish() {
    syncOutcomeTags();
    flushNote();
    advanceFocus(session, api.getState(), Date.now());
    session.endedAt = Math.max(session.startedAt, Date.now());
    session.phase = 'reflect';
    session.recovery ||= newRecovery(session.endedAt - session.startedAt);
    api.fadeAudio?.()?.catch?.((e) => api.toast(e.message));
    save();
    render();
  }
  function reflect() {
    base(voice('focus.reflectionHeading'));
    dialog.append(
      node('p', 'focus-mantra', session.mantra),
      node(
        'p',
        'focus-lead',
        `${durationLabel(session.endedAt - session.startedAt)} ${voice('focus.reflectionDurationSuffix')}`,
      ),
    );
    for (const [key, label] of [
      ['progress', 'What moved forward?'],
      ['learned', 'What did you learn, if anything?'],
      ['next', 'Where will you pick up next?'],
    ]) {
      const field = node('label', 'focus-reflection-label', label),
        input = node('textarea');
      input.rows = 3;
      input.value = session.reflection[key];
      input.setAttribute('aria-label', label);
      input.addEventListener('input', () => {
        session.reflection[key] = input.value;
        save();
      });
      field.append(input);
      dialog.append(field);
    }
    session.recovery ||= newRecovery(session.endedAt - session.startedAt);
    dialog.append(recoverySection(session.recovery, save));
    const controls = node('div', 'inline');
    const saveButton = button('Save reflection & close', () => complete(false), 'primary'),
      skip = button('Skip reflection & close', () => complete(true));
    function complete(skipReflection) {
      const minutes = dialog.querySelector('[aria-label="Break duration (minutes)"]');
      if (
        minutes &&
        (!minutes.reportValidity() ||
          !Number.isInteger(Number(minutes.value)) ||
          Number(minutes.value) < 1 ||
          Number(minutes.value) > 120)
      ) {
        error = 'Choose 1–120 whole break minutes.';
        status();
        return;
      }
      if (skipReflection) session.reflection = { progress: '', learned: '', next: '' };
      save();
      let saved = false;
      try {
        saved = api.saveReport(session);
      } catch (cause) {
        error = 'Could not save the session: ' + cause.message;
        status();
        return;
      }
      if (saved) {
        const recovery = session.recovery;
        clear();
        if (recovery.startTimer) breakTimer.start(recovery.minutes);
        dialog.close();
        buttons();
        api.refresh();
        api.toast('Focus session saved inside its interval note.');
        if (recovery.celebrate)
          window.dispatchEvent(
            new CustomEvent('dayline:effect', { detail: { kind: 'focus-finish' } }),
          );
      } else {
        error = 'Your session could not be saved. Your draft is kept here so you can try again.';
        status();
      }
    }
    controls.append(saveButton, skip);
    dialog.append(controls);
  }
  function render() {
    if (!session) return;
    refreshPageSnapshot();
    syncOutcomeTags();
    if (session.phase === 'prepare') {
      if (flowOpen) extendedPreparation();
      else prepare();
    } else if (session.phase === 'reflect') reflect();
    else active();
    buttons();
  }
  function clear() {
    flowView?.destroy();
    flowView = null;
    flowOpen = false;
    flushNote();
    if (session?.owner === owner) {
      try {
        const draft = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (draft?.owner === owner) localStorage.removeItem(KEY);
      } catch {}
    }
    session = null;
    transition = false;
    dialog.classList.remove('focus-committing');
  }
  function recover() {
    dialog.replaceChildren(
      node('h1', '', 'Recover your Focus draft'),
      node('p', '', 'This draft could not be read. Download it before starting fresh.'),
    );
    dialog.append(
      button('Download draft', () => {
        const raw = localStorage.getItem(KEY) || '';
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
          a = node('a');
        a.href = url;
        a.download = 'dayline-focus-recovery.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
      button('Discard draft and start fresh', () => {
        localStorage.removeItem(KEY);
        unreadable = false;
        dialog.close();
        start();
      }),
      button('Close', () => dialog.close()),
    );
    dialog.showModal();
  }
  function start() {
    if (unreadable) {
      recover();
      return;
    }
    api.flushEditor();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) session = validFocusDraft(JSON.parse(raw));
    } catch {
      unreadable = true;
      recover();
      return;
    }
    if (!session) {
      session = newFocus(api.getState(), Date.now(), crypto.randomUUID(), owner);
      session.mantra = focusMantras(MANTRAS)[0];
    }
    open();
  }
  function open() {
    if (!session) return;
    api.flushEditor();
    session.owner = owner;
    advanceFocus(session, api.getState(), Date.now());
    save(true);
    render();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    buttons();
  }
  launch.addEventListener('click', start);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    minimize();
  });
  dialog.addEventListener('close', buttons);
  // Only a gesture that starts and ends on the backdrop minimizes the session.
  // Selecting text or dragging a control out of the window must not dismiss it.
  let backdropPress = false;
  function onBackdrop(event) {
    const rect = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    );
  }
  dialog.addEventListener('pointerdown', (event) => {
    backdropPress = event.isPrimary && event.button === 0 && onBackdrop(event);
  });
  dialog.addEventListener('pointercancel', () => {
    backdropPress = false;
  });
  dialog.addEventListener('click', (event) => {
    const dismiss = backdropPress && onBackdrop(event);
    backdropPress = false;
    if (dismiss) minimize();
  });
  function tickLabels() {
    if (!session) return;
    const elapsed = Math.max(
      0,
      (session.endedAt || Date.now()) - (session.startedAt || Date.now()),
    );
    const elapsedNode = dialog.querySelector('.focus-elapsed');
    if (elapsedNode) elapsedNode.hidden = !!session.flow?.hideClock;
    if (elapsedNode) elapsedNode.textContent = 'Session · ' + durationLabel(elapsed);
    const position = dialog.querySelector('.focus-live-position');
    if (position)
      position.textContent =
        session.viewIndex === session.pages.length - 1
          ? 'Current interval'
          : 'Reviewing an earlier interval';
    const idea = dialog.querySelector('.focus-inspiration');
    if (idea)
      idea.textContent =
        focusIdeas(INSPIRATION)[
          (session.seed + Math.floor(elapsed / 600000)) % focusIdeas(INSPIRATION).length
        ];
    buttons();
  }
  function tick() {
    if (!session) return;
    if (session.owner === owner && session.phase !== 'reflect') {
      const slot = api.getState(),
        last = session.pages.at(-1).key;
      // Flush an open note before changing its interval page.
      const now = new Date(),
        key = `${dayKey(now)}:${bucket(now.getHours() * 60 + now.getMinutes(), slot.settings.interval)}:${slot.settings.interval}`;
      if (last !== key) {
        flushNote();
        if (advanceFocus(session, slot, Date.now())) {
          save();
          if (dialog.open && !transition && !flowOpen) render();
        }
      }
    }
    refreshNotes();
    tickLabels();
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('pagehide', () => {
    flushNote();
    if (session?.owner === owner) save();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    try {
      const incoming = event.newValue ? validFocusDraft(JSON.parse(event.newValue)) : null;
      if (incoming?.owner === owner) return;
      flushNote();
      session = incoming;
      dialog.close();
      buttons();
    } catch {
      error = 'A focus draft from another tab could not be read.';
      status();
    }
  });
  window.addEventListener('dayline:appearance', () => {
    if (session && dialog.open && !transition) render();
  });
  window.addEventListener('dayline:notes-changed', refreshNotes);
  buttons();
  return {
    refresh() {
      buttons();
      refreshNotes();
    },
    minimize,
  };
}
