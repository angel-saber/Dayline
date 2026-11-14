import { reorderCommitments, bindCommitmentReorder } from './reorder.js?v=683d01a271f7';
import { commitmentTimelineDrag } from './timeline-drag.js?v=683d01a271f7';
import { commitmentColors } from './colors.js?v=683d01a271f7';
import {
  commitmentRecords,
  commitmentToken,
  importDeviceCommitments,
} from './account-state.js?v=683d01a271f7';
import { typeChips, categoryOptions, tagBadges } from '../notes/note-types.js?v=683d01a271f7';
import {
  readAwakeHours,
  awakeMinutes,
  isAwake,
  commitmentAllocation,
  assertCommitmentBudget,
  AWAKE_HOURS_EVENT,
  AWAKE_HOURS_KEY,
} from '../settings/awake-hours.js?v=683d01a271f7';
import { readTiming } from '../focus/timing.js?v=683d01a271f7';
import { dayKey } from '../../shared/dates.js?v=683d01a271f7';
import { bucket } from '../../shared/schedule.js?v=683d01a271f7';
import { availableHours, dailySlotVisible } from '../settings/available-hours.js?v=683d01a271f7';
import {
  COMMITMENT_STATE_KEY,
  DURATION_PRESETS,
  suggestedPracticeBreak,
  newCommitmentState,
  readCommitmentState,
  validCommitmentState,
  commitmentDone,
  evaluateGame,
  toggleGame,
  acknowledgePenalty,
  changeItems,
  pendingCommitments,
} from './game.js?v=683d01a271f7';
import { node } from '../../shared/dom.js?v=683d01a271f7';
import {
  COMMITMENTS_KEY,
  SUGGESTIONS,
  validCommitments,
  practiceProgress,
} from './model.js?v=683d01a271f7';
function button(text, action, kind = 'secondary') {
  const b = node('button', kind, text);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
}
export function setupCommitments({
  getState,
  getAccountId = () => null,
  saveAccountState = () => false,
  startPractice,
  prepareTimeline = () => false,
  schedulePractice = () => false,
  notify = () => {},
  openAwakeSettings = () => {},
  canNotify = () => true,
  storage = localStorage,
  now = () => new Date(),
}) {
  const launch = document.querySelector('#launch-commitments'),
    dialog = node('dialog', 'shortcuts-panel commitments-panel');
  dialog.id = 'commitments-panel';
  dialog.setAttribute('aria-labelledby', 'commitments-heading');
  document.body.append(dialog);
  launch.setAttribute('aria-controls', dialog.id);
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  const header = node('div', 'shortcuts-header commitment-header'),
    heading = node('h2', '', 'Daily Commitments');
  heading.id = 'commitments-heading';
  function close() {
    dialog.close();
  }
  const closeButton = button('Close', close, 'commitment-close');
  header.append(heading, closeButton);
  const accountPanel = node('section', 'commitment-account-panel');
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const listHeading = node('div', 'commitment-list-heading');
  const list = node('div', 'commitments-list'),
    form = node('form', 'shortcut-form'),
    formTitle = node('h3', '', 'Add a daily practice');
  const tagHost = node('div', 'commitment-category-picker');
  let tagPicker = null;
  function renderTagPicker(value = []) {
    const state = getState();
    const days = {
      ...state.days,
      'commitment-categories': items.map((item) => ({ tags: item.tags || [] })),
    };
    tagPicker = typeChips(
      value,
      'Categories',
      () => {},
      categoryOptions(days, state.settings?.tags),
    );
    tagHost.replaceChildren(tagPicker.element);
  }
  const suggestions = node('div', 'commitment-suggestions');
  const titleLabel = node('label', '', 'Habit'),
    title = node('input');
  title.type = 'text';
  title.required = true;
  title.maxLength = 100;
  title.setAttribute('aria-label', 'Habit name');
  titleLabel.append(title);
  const bodyLabel = node('label', '', 'Details (optional)'),
    body = node('textarea');
  body.rows = 4;
  body.maxLength = 10000;
  body.setAttribute('aria-label', 'Commitment details');
  body.placeholder = 'Instructions, ideas, or reminders for this practice…';
  bodyLabel.append(body);
  const minuteLabel = node('label', '', 'Daily focus minutes'),
    minutes = node('input');
  minutes.type = 'number';
  minutes.min = '2';
  minutes.max = '1440';
  minutes.step = '1';
  minutes.required = true;
  minutes.value = '30';
  minutes.setAttribute('aria-label', 'Daily focus minutes');
  minuteLabel.append(minutes);
  for (const text of SUGGESTIONS)
    suggestions.append(
      button(text, () => {
        title.value = text;
        title.focus();
      }),
    );
  const presets = node('div', 'commitment-suggestions');
  const breakLabel = node('label', '', 'Optional break minutes (0 means no break)'),
    breakMinutes = node('input');
  breakMinutes.type = 'number';
  breakMinutes.min = '0';
  breakMinutes.max = '120';
  breakMinutes.step = '1';
  breakMinutes.value = '5';
  breakMinutes.setAttribute('aria-label', 'Commitment break minutes');
  breakLabel.append(breakMinutes);
  const breakHint = node(
    'p',
    'field-hint',
    'Suggested breaks are starting points, not standards: short practices need no preset break; 25–30 min → 5, 45–60 → 10, 90–120 → 15. Set any break from 0–120 minutes.',
  );
  for (const duration of DURATION_PRESETS)
    presets.append(
      button(`${duration} min`, () => {
        minutes.value = String(duration);
        breakMinutes.value = String(suggestedPracticeBreak(duration));
      }),
    );
  const capacity = node('section', 'commitment-capacity');
  const gamePanel = node('section', 'commitment-game');
  const gameLabel = node('label'),
    gameToggle = node('input');
  gameToggle.type = 'checkbox';
  gameToggle.setAttribute('aria-label', 'Commitment game mode');
  gameLabel.append(gameToggle, document.createTextNode('Optional game mode'));
  const pingLabel = node('label'),
    pingToggle = node('input');
  pingToggle.type = 'checkbox';
  pingToggle.setAttribute('aria-label', 'Suggest commitments in empty intervals');
  pingLabel.append(
    pingToggle,
    document.createTextNode(
      'Suggest pending commitments in empty intervals (requires notifications)',
    ),
  );
  const save = node('button', 'primary', 'Add commitment');
  save.type = 'submit';
  const cancel = button('Cancel edit', reset);
  cancel.hidden = true;
  form.append(
    formTitle,
    node(
      'p',
      'field-hint',
      'Choose a suggestion or write your own. Show up for the practice; no specific outcome required.',
    ),
    suggestions,
    titleLabel,
    bodyLabel,
    tagHost,
    presets,
    minuteLabel,
    breakLabel,
    breakHint,
    save,
    cancel,
  );
  const composer = node('details', 'commitment-composer');
  composer.append(node('summary', '', '＋ Add a practice'), form);
  const preferences = node('details', 'commitment-preferences');
  preferences.append(
    node('summary', '', 'Preferences & game mode'),
    node(
      'p',
      'field-hint',
      'Card colors follow your saved list order, repeating through the active personality’s palette.',
    ),
    node(
      'p',
      'field-hint',
      'Tap a card to prepare Focus. Swipe right or tap the check to mark it done without a session.',
    ),
    pingLabel,
    gameLabel,
    gamePanel,
    node(
      'p',
      'field-hint',
      'Without an account, commitments stay in this browser. When signed in, the account list and progress sync; existing device habits can be imported separately.',
    ),
  );
  dialog.append(
    node('p', 'commitment-eyebrow', 'DAYLINE / DAILY PRACTICE'),
    header,
    node('p', 'commitment-subtitle', 'A little time. Every day.'),
    capacity,
    accountPanel,
    status,
    listHeading,
    list,
    composer,
    preferences,
  );
  let commitmentState = newCommitmentState(),
    loadedRaw = null,
    loadedScope = null,
    writing = false;
  const rawToken = () =>
    getAccountId()
      ? commitmentToken(getState().days)
      : (storage.getItem(COMMITMENT_STATE_KEY) ?? 'legacy:' + storage.getItem(COMMITMENTS_KEY));
  let items = [],
    editing = null,
    unreadable = false,
    returnFocus = null;
  function read() {
    try {
      loadedScope = getAccountId();
      const shared = loadedScope ? commitmentRecords(getState().days)[0] : null;
      commitmentState = loadedScope
        ? shared
          ? validCommitmentState(JSON.parse(shared.text))
          : newCommitmentState()
        : readCommitmentState(storage);
      loadedRaw = rawToken();
      items = commitmentState.items;
      unreadable = false;
      save.disabled = false;
    } catch {
      unreadable = true;
      save.disabled = true;
      composer.open = true;
      status.textContent = 'Saved commitments could not be read. They have not been overwritten.';
    }
  }
  function reset() {
    editing = null;
    title.value = '';
    body.value = '';
    minutes.value = '30';
    breakMinutes.value = '5';
    renderTagPicker([]);
    formTitle.textContent = 'Add a daily practice';
    save.textContent = 'Add commitment';
    cancel.hidden = true;
    composer.open = false;
  }
  function persist(next) {
    try {
      if (unreadable)
        throw Error('Saved commitments could not be read. They have not been overwritten.');
      if (getAccountId() !== loadedScope || rawToken() !== loadedRaw)
        throw Error('Commitments changed in another tab. Reopen this list before saving.');
      if (Array.isArray(next))
        assertCommitmentBudget(items, next, readAwakeHours(storage), readTiming(storage));
      const validated = validCommitmentState(
        Array.isArray(next) ? changeItems(commitmentState, next) : next,
      );
      if (loadedScope) {
        writing = true;
        try {
          if (!saveAccountState(validated, loadedRaw))
            throw Error('Account changes could not be saved. Your draft is kept here.');
        } finally {
          writing = false;
        }
      } else storage.setItem(COMMITMENT_STATE_KEY, JSON.stringify(validated));
      loadedRaw = rawToken();
      commitmentState = validated;
      items = validated.items;
      return true;
    } catch (e) {
      status.textContent = 'Could not save commitments. ' + e.message;
      return false;
    }
  }
  function settle() {
    if (unreadable) return;
    const today = dayKey(),
      game = commitmentState.game;
    if (!game.enabled || game.pending || (game.nextDate >= today && game.snapshots[today])) return;
    const evaluated = evaluateGame(commitmentState, getState().days);
    if (JSON.stringify(evaluated) !== JSON.stringify(commitmentState)) {
      if (persist(evaluated)) {
        launch.textContent = commitmentState.game.pending
          ? 'Daily Commitments · !'
          : 'Daily Commitments';
        launch.title = commitmentState.game.pending
          ? 'One game adjustment is waiting for acknowledgment'
          : 'Daily Commitments';
      }
    }
  }
  gameToggle.onchange = () => {
    if (persist(toggleGame(commitmentState, gameToggle.checked))) render();
  };
  pingToggle.onchange = () => {
    if (persist({ ...commitmentState, pingEnabled: pingToggle.checked })) render();
  };
  function render() {
    settle();
    accountPanel.replaceChildren();
    if (getAccountId()) {
      accountPanel.append(
        node(
          'p',
          'field-hint',
          'Commitments, completion history and game progress sync with this account. Timer and awake-hour preferences remain device-local.',
        ),
      );
      const records = commitmentRecords(getState().days);
      if (records.length > 1) {
        accountPanel.append(
          node(
            'p',
            '',
            'Two saved lists were kept after a sync conflict. Choose the version to continue with; the other versions remain in account backups.',
          ),
        );
        for (const record of records) {
          const version = validCommitmentState(JSON.parse(record.text));
          accountPanel.append(
            button(
              `Use saved version · ${version.items.map((i) => i.title).join(', ') || 'empty list'}`,
              () => {
                writing = true;
                try {
                  if (saveAccountState(version, rawToken(), record.id)) {
                    read();
                    reset();
                    render();
                  }
                } catch (e) {
                  status.textContent = e.message;
                } finally {
                  writing = false;
                }
              },
            ),
          );
        }
      }
      try {
        const device = readCommitmentState(storage),
          marker = 'dayline.commitment-import.v1:' + getAccountId(),
          signature = JSON.stringify(device);
        if (device.items.length && storage.getItem(marker) !== signature) {
          const review = node('details');
          review.append(
            node(
              'summary',
              '',
              `Bring over this device’s ${device.items.length} saved commitments`,
            ),
            node('p', 'field-hint', device.items.map((i) => i.title).join(' · ')),
            node(
              'p',
              'field-hint',
              'Add these to your account without deleting the device copy. Existing account habits are kept; conflicting versions are copied separately.',
            ),
          );
          review.append(
            button('Add this device’s commitments to my account', () => {
              try {
                const imported = importDeviceCommitments(commitmentState, device);
                if (persist(imported)) {
                  try {
                    storage.setItem(marker, signature);
                  } catch {}
                  reset();
                  render();
                  status.textContent =
                    'Device commitments added to your account. The original device copy was kept.';
                }
              } catch (e) {
                status.textContent = e.message;
              }
            }),
          );
          accountPanel.append(review);
        }
      } catch {
        accountPanel.append(
          node(
            'p',
            'field-hint',
            'A device commitment copy could not be read. It has not been overwritten.',
          ),
        );
      }
    }
    gameToggle.checked = commitmentState.game.enabled;
    pingToggle.checked = commitmentState.pingEnabled;
    capacity.replaceChildren(
      node(
        'p',
        '',
        `Daily allocation: ${commitmentAllocation(items, readTiming(storage))} / ${awakeMinutes(readAwakeHours(storage))} awake minutes, including configured breaks.`,
      ),
      button('Adjust Awake Hours', () => {
        close();
        openAwakeSettings();
      }),
    );
    gamePanel.replaceChildren();
    const game = commitmentState.game;
    launch.textContent = game.pending ? 'Daily Commitments · !' : 'Daily Commitments';
    launch.title = game.pending
      ? 'One game adjustment is waiting for acknowledgment'
      : 'Daily Commitments';
    launch.setAttribute(
      'aria-label',
      game.pending ? 'Daily Commitments: one game adjustment waiting' : 'Daily Commitments',
    );
    if (game.enabled) {
      gamePanel.append(
        node(
          'p',
          '',
          `Commitment limit: ${game.cap} · Completed days toward the next slot: ${game.wins}/7. Days settle after midnight.`,
        ),
        node(
          'p',
          'field-hint',
          'Seven consecutive completed days unlock one slot. Two consecutive incomplete days request one adjustment. No further penalties accumulate until you acknowledge it. The next run starts today after acknowledgment.',
        ),
      );
      if (game.pending) {
        gamePanel.append(
          node(
            'p',
            '',
            items.length > 1
              ? 'One adjustment is waiting: choose a commitment to remove below.'
              : 'One adjustment is waiting: reduce your last commitment by 5 minutes, down to a 2-minute minimum.',
          ),
        );
        if (items.length <= 1)
          gamePanel.append(
            button(
              items[0]?.minutes > 2
                ? 'Acknowledge & reduce by 5 minutes'
                : 'Acknowledge · minimum already reached',
              () => {
                if (persist(acknowledgePenalty(commitmentState, null))) {
                  reset();
                  render();
                }
              },
            ),
          );
      }
    }
    const completed = items.filter((item) =>
      commitmentDone(commitmentState, item, dayKey(), getState().days),
    ).length;
    listHeading.replaceChildren(
      node('span', '', 'TODAY'),
      node('span', '', `${completed} / ${items.length} complete`),
    );
    if (game.pending) preferences.open = true;
    list.replaceChildren();
    if (!items.length) list.append(node('p', 'field-hint', 'Add your first practice below.'));
    for (const item of items) {
      const row = node('section', 'commitment-row');
      row.dataset.commitmentId = item.id;
      let reorderScope, reorderRaw;
      const reorder = button('⠿', () => {}, 'commitment-reorder-handle');
      reorder.setAttribute(
        'aria-label',
        `Reorder ${item.title}. Drag or use up and down arrow keys.`,
      );
      reorder.title = 'Drag to reorder · arrow keys also work';
      const stepOrder = bindCommitmentReorder(reorder, {
        list,
        id: item.id,
        begin() {
          reorderScope = loadedScope;
          reorderRaw = loadedRaw;
        },
        move(id, target, after) {
          if (getAccountId() !== reorderScope || rawToken() !== reorderRaw) {
            status.textContent = 'Commitments changed. Reopen the list before reordering.';
            return;
          }
          const next = reorderCommitments(items, id, target, after);
          const updated = { ...commitmentState, items: next };
          if (persist(updated)) {
            render();
            [...list.querySelectorAll('[data-commitment-id]')]
              .find((row) => row.dataset.commitmentId === id)
              ?.querySelector('.commitment-reorder-handle')
              ?.focus({ preventScroll: true });
            status.textContent = 'Commitment order saved.';
          }
        },
      });
      row.append(reorder);

      const colors = commitmentColors(items.indexOf(item));
      row.style.setProperty('--commitment-card', colors.background);
      row.style.setProperty('--commitment-card-ink', colors.ink);
      row.style.setProperty('--commitment-done-card', colors.completedBackground);
      row.style.setProperty('--commitment-done-ink', colors.completedInk);
      const total = practiceProgress(getState().days, item.id);
      const done = commitmentDone(commitmentState, item, dayKey(), getState().days);
      const manual = commitmentState.marks[dayKey()]?.includes(item.id);
      row.classList.toggle('commitment-done', done);
      const mark = () => {
        if (done && !manual) return;
        const next = structuredClone(commitmentState),
          date = dayKey();
        const ids = new Set(next.marks[date] || []);
        ids.has(item.id) ? ids.delete(item.id) : ids.add(item.id);
        next.marks[date] = [...ids];
        if (persist(next)) render();
      };
      let pointer = null,
        swiped = false;
      row.addEventListener('pointerdown', (e) => {
        if (
          e.button !== 0 ||
          e.target.closest(
            '.commitment-controls,.commitment-timeline-drag,.commitment-body-details',
          )
        )
          return;
        pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      });
      row.addEventListener('pointercancel', () => {
        pointer = null;
      });
      row.addEventListener('pointerup', (e) => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const dx = e.clientX - pointer.x,
          dy = e.clientY - pointer.y;
        pointer = null;
        if (dx >= 60 && dx > Math.abs(dy) * 1.4) {
          swiped = true;
          e.preventDefault();
          mark();
        }
      });
      row.addEventListener(
        'click',
        (e) => {
          if (swiped) {
            swiped = false;
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true,
      );
      const start = button(
        item.title,
        () => {
          close();
          startPractice(item);
        },
        'commitment-start',
      );
      start.setAttribute('aria-label', `Start ${item.minutes}-minute practice: ${item.title}`);
      row.append(start, ...(done ? [node('strong', '', 'Done today')] : []));
      const info = node('div', 'commitment-card-info');
      info.append(
        node(
          'p',
          'commitment-card-meta',
          `${item.minutes} min${item.breakMinutes ? ` · ${item.breakMinutes} min break` : ''} · ${Math.floor(total / 60000)} min today`,
        ),
      );
      const badges = tagBadges(item);
      if (badges) {
        badges.classList.add('commitment-card-tags');
        info.append(badges);
      }
      row.append(info);
      const details = node('details', 'commitment-body-details');
      details.append(
        node('summary', '', 'Details'),
        node(
          'p',
          'commitment-body',
          item.body || 'Add instructions, ideas, or reminders using Edit.',
        ),
      );

      let dragScope, dragRaw;
      const drag = button('⠿ Drag to timeline', () => {}, 'commitment-timeline-drag');
      drag.setAttribute('aria-label', `Drag ${item.title} to the Daily timeline`);
      commitmentTimelineDrag(drag, {
        root: document.querySelector('#timeline') || list,
        interval: () => getState().settings.interval,
        clock: () => getState().settings.clock,
        begin() {
          dragScope = loadedScope;
          dragRaw = loadedRaw;
          if (prepareTimeline() === false) return false;
          close();
          return true;
        },
        drop(minute) {
          if (getAccountId() !== dragScope || rawToken() !== dragRaw) {
            open();
            status.textContent = 'Commitments changed. Please try dragging again.';
            return;
          }
          if (!schedulePractice(item, minute)) open();
        },
        cancel: open,
      });
      const secondary = node('div', 'commitment-secondary');
      secondary.append(details, drag);
      row.append(secondary);
      const controls = node('div', 'inline commitment-controls');
      const doneButton = button(
        done ? (manual ? 'Undo done' : 'Completed by practice') : 'Mark done',
        mark,
      );
      doneButton.className = 'commitment-complete';
      doneButton.setAttribute(
        'aria-label',
        done ? (manual ? 'Undo done' : 'Completed by practice') : 'Mark done',
      );
      doneButton.setAttribute('aria-pressed', String(done));
      doneButton.disabled = done && !manual;
      controls.append(doneButton);
      if (game.enabled && game.pending && items.length > 1)
        row.append(
          button('Confirm removal for game adjustment', () => {
            if (persist(acknowledgePenalty(commitmentState, item.id))) {
              reset();
              render();
            }
          }),
        );
      const menu = node('details', 'commitment-card-menu'),
        menuTitle = node('summary', '', '•••');
      menuTitle.setAttribute('aria-label', `Manage ${item.title}`);
      const menuActions = node('div', 'commitment-menu-actions');
      menu.append(menuTitle, menuActions);
      controls.append(menu);
      menuActions.append(
        button('Move up', () => stepOrder(-1)),
        button('Move down', () => stepOrder(1)),
        button('Edit', () => {
          editing = item.id;
          title.value = item.title;
          body.value = item.body || '';
          renderTagPicker(item.tags || []);
          minutes.value = String(item.minutes);
          breakMinutes.value = String(item.breakMinutes ?? suggestedPracticeBreak(item.minutes));
          formTitle.textContent = 'Edit daily practice';
          save.textContent = 'Save commitment';
          cancel.hidden = false;
          composer.open = true;
          menu.open = false;
          composer.scrollIntoView?.({ block: 'nearest' });
          title.focus();
        }),
        button('Remove', () => {
          if (commitmentState.game.pending) {
            status.textContent =
              'Use the game adjustment confirmation, or disable game mode first.';
            return;
          }
          if (persist(items.filter((v) => v.id !== item.id))) {
            if (editing === item.id) reset();
            render();
            status.textContent = 'Commitment removed. Saved notes and session reports were kept.';
          }
        }),
      );
      row.append(controls);
      list.append(row);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (editing && !items.some((v) => v.id === editing)) {
      status.textContent =
        'This commitment changed in another tab. Reopen the list before editing.';
      return;
    }
    const item = {
      id: editing || crypto.randomUUID(),
      title: title.value,
      body: body.value,
      minutes: Number(minutes.value),
      breakMinutes: Number(breakMinutes.value),
      tags: tagPicker?.value || [],
    };
    if (item.minutes < 2) {
      status.textContent = 'Choose at least 2 practice minutes.';
      return;
    }
    if (commitmentState.game.pending) {
      status.textContent = 'Acknowledge the waiting game adjustment, or disable game mode first.';
      return;
    }
    if (persist(editing ? items.map((v) => (v.id === editing ? item : v)) : [...items, item])) {
      reset();
      render();
      status.textContent = 'Daily commitment saved.';
    }
  });
  function open() {
    if ([...document.querySelectorAll('dialog[open]')].length) return;
    returnFocus = document.activeElement;
    read();
    renderTagPicker(tagPicker?.value || []);
    render();
    dialog.showModal();
    launch.setAttribute('aria-expanded', 'true');
  }
  launch.addEventListener('click', open);
  dialog.addEventListener('close', () => {
    launch.setAttribute('aria-expanded', 'false');
    returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  let backdrop = false;
  function outside(event) {
    const r = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    );
  }
  dialog.addEventListener('pointerdown', (e) => {
    for (const menu of dialog.querySelectorAll('.commitment-card-menu[open]'))
      if (!menu.contains(e.target)) menu.open = false;
    backdrop = e.button === 0 && outside(e);
  });
  dialog.addEventListener('pointercancel', () => {
    backdrop = false;
  });
  dialog.addEventListener('click', (e) => {
    const dismiss = backdrop && outside(e);
    backdrop = false;
    if (dismiss) close();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === COMMITMENTS_KEY || event.key === COMMITMENT_STATE_KEY || event.key === null) {
      read();
      reset();
      render();
    }
  });
  window.addEventListener('dayline:account', () => {
    if (dialog.open) close();
    read();
    reset();
    render();
  });
  window.addEventListener('dayline:notes-changed', () => {
    if (writing) return;
    if (getAccountId() !== loadedScope) {
      read();
      reset();
    } else if (getAccountId() && rawToken() !== loadedRaw) {
      // Keep an open form draft intact; its stale-save check protects incoming changes.
      if (dialog.open && composer.open) {
        status.textContent =
          'Account commitments changed. Close and reopen this list before saving your draft.';
        return;
      }
      read();
    }
    if (dialog.open) render();
  });
  window.addEventListener('dayline:appearance', () => {
    if (dialog.open) render();
  });
  window.addEventListener(AWAKE_HOURS_EVENT, () => {
    if (dialog.open) render();
  });
  read();
  renderTagPicker([]);
  render();
  function checkPings() {
    if (!canNotify() || unreadable) return;
    let latest;
    try {
      latest = rawToken();
    } catch {
      return;
    }
    if (getAccountId() !== loadedScope || latest !== loadedRaw) {
      if (getAccountId() === loadedScope && getAccountId() && dialog.open && composer.open) return;
      read();
      if (dialog.open) render();
    }
    settle();
    const state = getState(),
      settings = state.settings || {};
    if (unreadable || !commitmentState.pingEnabled || !settings.notifications || !items.length)
      return;
    const instant = now(),
      date = dayKey(instant),
      minute = instant.getHours() * 60 + instant.getMinutes(),
      slot = bucket(minute, settings.interval);
    const token = `${date}:${slot}:${settings.interval}`;
    const pingKey = 'dayline.commitment-ping.v1:' + (getAccountId() || 'guest');
    try {
      if (commitmentState.lastPing === token || storage.getItem(pingKey) === token) return;
    } catch {
      return;
    }
    try {
      if (storage.getItem('dayline.focus.v1')) return;
      const rest = JSON.parse(storage.getItem('dayline.focus-break.v1') || 'null');
      if (rest?.until > instant.getTime()) return;
    } catch {
      return;
    }
    if (!isAwake(minute, readAwakeHours(storage))) return;
    const empty = !(state.days[date] || []).some(
      (n) => !n.weekly && !n.yearly && !n.allDay && bucket(n.minute, settings.interval) === slot,
    );
    const pending = pendingCommitments(commitmentState, state.days, date);
    if (getAccountId()) {
      try {
        storage.setItem(pingKey, token);
        commitmentState.lastPing = token;
      } catch {
        return;
      }
    } else if (!persist({ ...commitmentState, lastPing: token })) return;
    if (
      empty &&
      pending.length &&
      dailySlotVisible(slot, settings.interval, availableHours(settings))
    )
      notify(
        {
          title: 'Time for a Daily Commitment?',
          text: `This interval is free. Try ${pending[0].title} for ${pending[0].minutes} minutes, or choose another commitment.`,
        },
        'dayline-commitment:' + token,
      );
  }
  const pingTimer = setInterval(checkPings, 1000);
  pingTimer?.unref?.();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkPings();
  });
  return {
    open,
    recordPractice(practice, start, end) {
      if (unreadable || !Number.isFinite(start) || !Number.isFinite(end)) return false;
      const item = items.find((v) => v.id === practice.id);
      if (!item || end - start < Math.max(item.minutes, practice.minutes) * 60000) return false;
      const date = dayKey(new Date(start));
      if (commitmentState.marks[date]?.includes(item.id)) return true;
      const next = structuredClone(commitmentState);
      next.marks[date] = [...(next.marks[date] || []), item.id];
      const saved = persist(next);
      if (saved && dialog.open) render();
      return saved;
    },
    checkPings,
    destroy() {
      clearInterval(pingTimer);
      dialog.remove();
    },
  };
}
