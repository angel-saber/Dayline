import { node } from '../../shared/dom.js?v=6245e2ad6c01';
import { weekStart } from '../monthly/weekly-model.js?v=6245e2ad6c01';
import { offsetDay } from '../../shared/schedule.js?v=6245e2ad6c01';
import { indentLevel } from '../notes/formatting/indents.js?v=6245e2ad6c01';
import {
  shareAttachments,
  prepareShareFiles,
  supportsFileShare,
} from './share-files.js?v=6245e2ad6c01';
import { attachmentList } from '../attachments/attachments.js?v=6245e2ad6c01';
import { parseDay, timeLabel } from '../../shared/schedule.js?v=6245e2ad6c01';
import { noteTasks } from '../notes/formatting/tasks.js?v=6245e2ad6c01';
import { NOTE_TYPES, categoryLabel, noteTags } from '../notes/note-types.js?v=6245e2ad6c01';
import { safeLink } from '../notes/formatting/links.js?v=6245e2ad6c01';
import { durationLabel } from '../focus/model.js?v=6245e2ad6c01';
import { dimensions, compassTitle, compassDates } from '../activities/model.js?v=6245e2ad6c01';
import { activityCatalog, activityFields } from '../activities/catalog.js?v=6245e2ad6c01';
export const SHARE_DEFAULTS = {
  dateTime: true,
  type: true,
  focusReports: false,
  guidedReports: false,
  attachments: false,
};
function linkedLine(text, start, format = []) {
  const end = start + text.length,
    links = [];
  for (const mark of format
    .filter((m) => m.href && m.start < end && m.end > start)
    .sort((a, b) => a.start - b.start)) {
    const href = safeLink(mark.href);
    if (!href) continue;
    const a = Math.max(start, mark.start),
      b = Math.min(end, mark.end),
      last = links.at(-1);
    if (last && last.href === href && a <= last.end) last.end = Math.max(last.end, b);
    else links.push({ start: a, end: b, href });
  }
  let result = '',
    at = 0;
  for (const link of links) {
    const a = link.start - start,
      b = link.end - start;
    if (a < at) continue;
    const label = text.slice(a, b);
    result += text.slice(at, a) + label + (safeLink(label) === link.href ? '' : ` (${link.href})`);
    at = b;
  }
  return result + text.slice(at);
}
export function shareNoteText(entry, date, options = {}, clock = '12') {
  const settings = { ...SHARE_DEFAULTS, ...options },
    parts = [entry.title?.trim() || 'Dayline note'];
  if (settings.dateTime)
    parts.push(
      entry.weekly
        ? `Weekly note · ${parseDay(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} – ${parseDay(offsetDay(date, 6)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
        : `${parseDay(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${timeLabel(entry.minute, clock)}`,
    );
  if (settings.type && noteTags(entry).length)
    parts.push(noteTags(entry).map(categoryLabel).join(' · '));
  const tasks = noteTasks(entry);
  let start = 0;
  const body = entry.text
    .split('\n')
    .map((line) => {
      const task = tasks.find((t) => t.start === start),
        bullet = entry.bullets?.some((b) => b.start === start),
        text = linkedLine(line, start, entry.format),
        indent = '  '.repeat(indentLevel(entry.indents, start));
      start += line.length + 1;
      return `${indent}${task ? (task.done ? '☑ ' : '☐ ') : bullet ? '• ' : ''}${text}`;
    })
    .join('\n');
  if (body.trim()) parts.push('', body);
  if (settings.focusReports)
    for (const report of entry.focusReports || []) {
      parts.push(
        '',
        `Focus session · ${new Date(report.startedAt).toLocaleString()} · ${durationLabel(report.durationMs)}`,
        `My commitment: ${report.mantra}`,
      );
      const logs = report.logs
        .filter((l) => l.text.trim())
        .map((l) => `${l.date} · ${timeLabel(l.minute, clock)}\n${l.text}`)
        .join('\n\n');
      parts.push('Interruption log:', logs || 'No interruptions recorded.');
      for (const [key, label] of [
        ['progress', 'What moved forward'],
        ['learned', 'What I learned'],
        ['next', 'Where I will pick up next'],
      ])
        if (report.reflection[key]) parts.push(`${label}: ${report.reflection[key]}`);
    }
  if (settings.guidedReports)
    for (const report of entry.guidedActivities || []) {
      const title = report.activity ? activityCatalog[report.activity].title : 'Guided Planning';
      parts.push(
        '',
        `Guided activity · ${title} · ${new Date(report.completedAt).toLocaleString()}`,
      );
      for (const field of report.activity
        ? activityFields(report.activity)
        : dimensions.map((d) => ({ key: d.key, label: d.label })))
        if (report.answers[field.key]) parts.push(`${field.label}: ${report.answers[field.key]}`);
      if (report.timer)
        parts.push(
          report.timer.completed
            ? 'Two-minute timer completed.'
            : `Action timer: ${Math.floor(report.timer.elapsedMs / 1000)} seconds.`,
        );
      if (report.schedule)
        parts.push(
          `${compassTitle(report.schedule.date)}\nWeekly notes: ${(report.schedule.mode === 'weekly' ? compassDates(report.schedule.date).map(weekStart) : compassDates(report.schedule.date)).join(', ')}${report.schedule.mode === 'weekly' ? ' · undated Weekly Notes' : ' at ' + report.schedule.time}`,
        );
    }
  parts.push('', 'Planned with Dayline');
  return parts.join('\n');
}
export function shareNotesText(items, options = {}, clock = '12', heading = 'Dayline plan') {
  const settings = { ...SHARE_DEFAULTS, ...options },
    parts = [heading.trim() || 'Dayline plan'];
  const ranks = Object.keys(NOTE_TYPES),
    orderedTags = (entry) =>
      noteTags(entry)
        .slice()
        .sort((a, b) => {
          const ar = ranks.indexOf(a),
            br = ranks.indexOf(b);
          if (ar >= 0 || br >= 0)
            return (ar < 0 ? ranks.length : ar) - (br < 0 ? ranks.length : br);
          return categoryLabel(a).localeCompare(categoryLabel(b));
        });
  const groupKey = (entry) => JSON.stringify(orderedTags(entry)),
    groupLabel = (entry) => orderedTags(entry).map(categoryLabel).join(' + ') || 'Untagged';
  const byCategory = settings.organize === 'category';
  let previousDate = null,
    previousGroup = null;
  const ordered = [...items].sort((a, b) => {
    if (byCategory) {
      const at = noteTags(a.entry),
        bt = noteTags(b.entry);
      if (!at.length && bt.length) return 1;
      if (at.length && !bt.length) return -1;
      const group =
        groupLabel(a.entry).localeCompare(groupLabel(b.entry)) ||
        groupKey(a.entry).localeCompare(groupKey(b.entry));
      if (group) return group;
    }
    return a.date.localeCompare(b.date) || a.entry.minute - b.entry.minute;
  });
  for (const { date, entry } of ordered) {
    if (byCategory && groupKey(entry) !== previousGroup) {
      previousGroup = groupKey(entry);
      if (settings.type) {
        parts.push('', groupLabel(entry));
        previousDate = null;
      }
    }
    if (settings.dateTime && date !== previousDate) {
      parts.push(
        '',
        parseDay(date).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
      previousDate = date;
    }
    const text = shareNoteText(
      entry,
      date,
      { ...settings, dateTime: false, type: byCategory ? false : settings.type },
      clock,
    )
      .split('\n')
      .slice(1, -2)
      .join('\n');
    parts.push(
      '',
      `${settings.dateTime ? timeLabel(entry.minute, clock) + ' — ' : ''}${entry.title?.trim() || 'Dayline note'}`,
    );
    if (text.trim()) parts.push(text);
  }
  parts.push('', 'Planned with Dayline');
  return parts.join('\n');
}
export function openShareNote(entry, date, clock = '12') {
  return openShareItems([{ entry, date }], clock, false);
}
export function openShareNotes(items, clock = '12') {
  if (items.length) return openShareItems(items, clock, true);
}
export function emailNoteUrl(title, text) {
  return `mailto:?subject=${encodeURIComponent(title?.trim() || 'Dayline note')}&body=${encodeURIComponent(text)}`;
}
function openShareItems(items, clock, multiple) {
  const { entry, date } = items[0];

  const dialog = node('dialog', 'share-note-dialog'),
    heading = node('h2', '', 'Share note');
  heading.id = 'share-note-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const intro = node(
    'p',
    'field-hint',
    'Share a clean text copy. Recipients do not need a Dayline account. Choose what to include below.',
  );
  let preparedFiles = [],
    loadingFiles = false,
    fileError = '',
    fileLoad = 0;
  const fileItems = shareAttachments(items);
  const options = { ...SHARE_DEFAULTS },
    choices = node('fieldset', 'share-note-options');
  choices.append(node('legend', '', 'Include in shared text'));
  const preview = node('textarea', 'share-note-preview');
  preview.readOnly = true;
  preview.rows = 12;
  preview.setAttribute('aria-label', 'Shared note preview');
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const email = node('a', 'secondary', 'Email'),
    titleInput = node('input');
  titleInput.type = 'text';
  titleInput.maxLength = 200;
  titleInput.value = 'Dayline plan';
  titleInput.setAttribute('aria-label', 'Shared plan heading');
  const shareTitle = () =>
    multiple ? titleInput.value.trim() || 'Dayline plan' : entry.title?.trim() || 'Dayline note';
  function refresh() {
    preview.value = multiple
      ? shareNotesText(items, options, clock, shareTitle())
      : shareNoteText(entry, date, options, clock);
    email.href = emailNoteUrl(shareTitle(), preview.value);
    email.textContent = options.attachments ? 'Email text only' : 'Email';
    status.textContent = '';
    refreshFiles();
  }
  for (const [key, label, available] of [
    ['dateTime', entry.weekly ? 'Week' : 'Date and time', true],
    ['type', 'Tags', items.some((item) => noteTags(item.entry).length > 0)],
    [
      'focusReports',
      'Focus reports, including reflections and interruption logs',
      items.some((item) => !!item.entry.focusReports?.length),
    ],
    [
      'guidedReports',
      'Guided activity reports',
      items.some((item) => !!item.entry.guidedActivities?.length),
    ],
    ['attachments', 'Include attachments', fileItems.length > 0],
  ]) {
    const wrapper = node('label', ''),
      check = node('input');
    check.type = 'checkbox';
    check.checked = available && options[key];
    check.disabled = !available;
    check.addEventListener('change', () => {
      options[key] = check.checked;
      if (key === 'attachments') loadFiles();
      refresh();
    });
    wrapper.append(check, document.createTextNode(label));
    choices.append(wrapper);
  }
  const actions = node('div', 'inline');
  const action = (text, fn, cls = 'secondary') => {
    const button = node('button', cls, text);
    button.type = 'button';
    button.onclick = fn;
    return button;
  };
  const filesSection = node('section', 'share-file-section'),
    filesStatus = node('p', 'field-hint');
  filesStatus.setAttribute('role', 'status');
  filesSection.append(node('h3', '', 'Attachments'), attachmentList(fileItems), filesStatus);
  function refreshFiles() {
    filesSection.hidden = !options.attachments;
    const supported = supportsFileShare(preparedFiles);
    share.disabled =
      typeof navigator.share !== 'function' ||
      (options.attachments && (loadingFiles || !!fileError || !supported));
    filesStatus.textContent = loadingFiles
      ? 'Preparing files…'
      : fileError ||
        (!supported
          ? 'This browser cannot share these files together. Download them above, then attach them in your email or messaging app.'
          : 'Share… includes these files. Choose Mail or a messaging app from the share menu. The receiving app controls size limits and whether accompanying text is included.');
    if (options.attachments)
      filesStatus.textContent += ' Copy text and Email text only do not include files.';
  }
  async function loadFiles() {
    const request = ++fileLoad;
    fileError = '';
    preparedFiles = [];
    loadingFiles = options.attachments;
    if (!options.attachments) return;
    try {
      const files = await prepareShareFiles(items);
      if (request === fileLoad) preparedFiles = files;
    } catch (error) {
      if (request === fileLoad) fileError = error.message;
    } finally {
      if (request === fileLoad) {
        loadingFiles = false;
        refreshFiles();
      }
    }
  }
  // Read files before the click: native sharing requires a fresh user gesture.
  const share = action(
    'Share…',
    async () => {
      try {
        const data = { title: shareTitle(), text: preview.value };
        if (options.attachments) {
          if (!supportsFileShare(preparedFiles) || loadingFiles || fileError)
            throw new Error('Files cannot be shared here. Download them instead.');
          data.files = preparedFiles;
        }
        await navigator.share(data);
        status.textContent = 'Shared.';
      } catch (error) {
        status.textContent =
          error.name === 'AbortError'
            ? 'Sharing cancelled.'
            : options.attachments
              ? 'Could not share these files. Try fewer files, or download them and attach them in your email or messaging app.'
              : 'Sharing is unavailable here. Use Copy text or Email instead.';
      }
    },
    'primary',
  );
  const copy = action('Copy text', async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = 'Copied to clipboard.';
    } catch {
      preview.focus();
      preview.select();
      status.textContent = 'Copy the selected preview using your device’s Copy command.';
    }
  });
  actions.append(
    share,
    copy,
    email,
    action('Close', () => dialog.close()),
  );
  dialog.append(heading, intro);
  if (multiple) {
    const label = node('label', 'share-preview-label', 'Heading (optional)');
    label.append(titleInput);
    dialog.append(label);
    titleInput.oninput = refresh;
    const organize = node('fieldset', 'share-note-options');
    organize.append(node('legend', '', 'Organize by'));
    for (const [key, text] of [
      ['date', 'Date & time'],
      ['category', 'Category'],
    ]) {
      const label = node('label', ''),
        radio = node('input');
      radio.type = 'radio';
      radio.name = 'share-organize';
      radio.checked = key === 'date';
      radio.addEventListener('change', () => {
        options.organize = key;
        refresh();
      });
      label.append(radio, document.createTextNode(text));
      organize.append(label);
    }
    dialog.append(
      organize,
      node(
        'p',
        'field-hint',
        'Category groups are sorted alphabetically (untagged notes last), with notes ordered by date and time inside each group. Multiple tags form one combined heading, so each note appears once. Turn Tags off to hide category headings.',
      ),
    );
  }
  dialog.append(
    choices,
    node('label', 'share-preview-label', 'Preview'),
    preview,
    filesSection,
    actions,
    status,
  );
  if (typeof navigator.share !== 'function')
    dialog.append(
      node(
        'p',
        'field-hint',
        'Your browser does not offer a sharing menu. Copy text and Email are available.',
      ),
    );
  dialog.addEventListener(
    'close',
    () => {
      fileLoad++;
      preparedFiles = [];
      dialog.remove();
    },
    { once: true },
  );
  const onAccount = () => dialog.close();
  window.addEventListener('dayline:account', onAccount, { once: true });
  dialog.addEventListener('close', () => window.removeEventListener('dayline:account', onAccount), {
    once: true,
  });
  document.body.append(dialog);
  refresh();
  dialog.showModal();
}
