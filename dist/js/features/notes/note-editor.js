import { node as element } from '../../shared/dom.js?v=5c319d31303c';
import {
  applyIndent,
  editIndents,
  indentLevel,
  MAX_INDENT,
} from './formatting/indents.js?v=5c319d31303c';
import {
  prepareUploadFiles,
  reviewCompression,
} from '../attachments/file-compression.js?v=5c319d31303c';
import { addFiles, attachmentList } from '../attachments/attachments.js?v=5c319d31303c';
import { typeChips, noteTags } from './note-types.js?v=5c319d31303c';
import { safeLink } from './formatting/links.js?v=5c319d31303c';
import { toggleBullets, editBullets, selectedLines } from './formatting/bullets.js?v=5c319d31303c';
import {
  HIGHLIGHTS,
  renderFormatted,
  editFormat,
  setLink,
} from './formatting/format.js?v=5c319d31303c';
import { lineRange, noteTasks, editTasks } from './formatting/tasks.js?v=5c319d31303c';
import {
  recognizeBullets,
  replaceText,
  insertLineBreak,
  applyStyle,
  applyCheckbox,
  checkTask,
  selectionStyle,
} from './editor-state.js?v=5c319d31303c';

const makeButton = (text, label, action) => {
  const el = element('button', '', text);
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.addEventListener('click', action);
  return el;
};

// The browser edits one surface. Only plain text, validated style ranges and line
// tasks enter storage; pasted HTML is never installed in the document.
export function createNoteEditor({
  entry,
  categories = {},
  minute = 0,
  label,
  onChange,
  onDone,
  onDuplicate,
  onRepeat,
  undated = false,
}) {
  let state = {
    indents: structuredClone(entry?.indents || []),
    attachments: structuredClone(entry?.attachments || []),
    tags: noteTags(entry || {}),
    minute: entry?.minute ?? minute,
    noteType: entry?.noteType || '',
    title: entry?.title || '',
    text: entry?.text || '',
    format: structuredClone(entry?.format || []),
    tasks: noteTasks(entry),
    bullets: structuredClone(entry?.bullets || []),
  };
  let selection = { start: state.text.length, end: state.text.length },
    typingStyle = null,
    composing = false,
    destroyed = false,
    pendingClose = false,
    pointerStartedInside = false;
  const past = [],
    future = [];
  const wrapper = element('div', 'editor'),
    toolbar = element('div', 'format-toolbar');
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Note formatting');
  const surface = element('div', 'rich-editor');
  surface.contentEditable = 'true';
  surface.setAttribute('role', 'textbox');
  surface.setAttribute('aria-multiline', 'true');
  surface.setAttribute('aria-label', label);
  surface.setAttribute('data-placeholder', 'A plan, a thought, a little reminder…');
  surface.spellcheck = true;
  const titleLabel = element('label', 'note-title-label', 'Note title');
  const titleInput = element('input', 'note-title-input');
  titleInput.type = 'text';
  titleInput.maxLength = 200;
  titleInput.placeholder = 'Title (optional)';
  titleInput.value = state.title;
  titleInput.setAttribute('aria-label', 'Note title');
  titleLabel.append(titleInput);
  const timeLabel = element('label', 'note-time-label', 'Note time'),
    timeInput = element('input');
  timeInput.type = 'time';
  timeInput.step = '60';
  timeInput.required = !undated;
  timeLabel.hidden = undated;
  timeInput.setAttribute('aria-label', 'Note time');
  timeInput.value = `${String(Math.floor(state.minute / 60)).padStart(2, '0')}:${String(state.minute % 60).padStart(2, '0')}`;
  timeLabel.append(timeInput);
  timeInput.addEventListener('change', () => {
    if (!timeInput.reportValidity()) return;
    const [hour, minute] = timeInput.value.split(':').map(Number);
    state = { ...state, minute: hour * 60 + minute };
    publish();
  });
  const noteType = typeChips(
    state.tags,
    'Tags (optional)',
    (value) => {
      state = { ...state, tags: value, noteType: value[0] || '' };
      publish();
    },
    categories,
  );
  titleInput.addEventListener('input', () => {
    state = { ...state, title: titleInput.value };
    publish();
  });
  const controls = element('div', 'editor-actions');
  controls.append(
    element(
      'small',
      '',
      'Saves as you write · Tab / Shift+Tab to indent · Esc or click outside to close',
    ),
  );
  const buttons = [];
  function snapshot() {
    return {
      state: structuredClone(state),
      selection: { ...selection },
      typingStyle: typingStyle && { ...typingStyle },
    };
  }
  function publish() {
    return onChange(structuredClone(state));
  }
  function offset(node, offset) {
    if (node === surface) {
      const row = surface.children[offset];
      return row ? Number(row.dataset.start) : state.text.length;
    }
    const row = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(
      '[data-editor-line]',
    );
    if (!row || !surface.contains(row)) return null;
    const range = document.createRange();
    const text = row.querySelector('.editable-line-text');
    if (!text.contains(node))
      return Number(node === row && offset > 0 ? row.dataset.end : row.dataset.start);
    range.selectNodeContents(text);
    range.setEnd(node, offset);
    return Number(row.dataset.start) + range.toString().length;
  }
  function readSelection() {
    const native = window.getSelection();
    if (
      !native?.rangeCount ||
      !surface.contains(native.anchorNode) ||
      !surface.contains(native.focusNode)
    )
      return;
    const anchor = offset(native.anchorNode, native.anchorOffset),
      focus = offset(native.focusNode, native.focusOffset);
    if (anchor === null || focus === null) return;
    const next = { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
    if (next.start !== selection.start || next.end !== selection.end) typingStyle = null;
    selection = next;
    refreshToolbar();
  }
  function point(position) {
    const rows = [...surface.children];
    const row =
      rows.find(
        (row) => Number(row.dataset.start) <= position && position <= Number(row.dataset.end),
      ) || rows.at(-1);
    const text = row.querySelector('.editable-line-text');
    let remaining = position - Number(row.dataset.start);
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let leaf;
    while ((leaf = walker.nextNode())) {
      if (remaining <= leaf.length) return [leaf, Math.max(0, remaining)];
      remaining -= leaf.length;
    }
    return [text, text.childNodes.length];
  }
  function restoreSelection() {
    surface.focus({ preventScroll: true });
    const range = document.createRange(),
      start = point(selection.start),
      end = point(selection.end);
    range.setStart(...start);
    range.setEnd(...end);
    const native = window.getSelection();
    native.removeAllRanges();
    native.addRange(range);
  }
  function refreshToolbar() {
    const style = typingStyle || selectionStyle(state, selection.start, selection.end);
    for (const { button, key, value } of buttons)
      button.setAttribute('aria-pressed', String(style[key] === value));
    const lines = selectedLines(state.text, selection.start, selection.end),
      hasTask = lines.every((at) => state.tasks.some((task) => task.start === at));
    taskButton.textContent =
      (hasTask ? 'Remove checkbox' : 'Add checkbox') + (lines.length > 1 ? 'es' : '');
    taskButton.setAttribute('aria-label', taskButton.textContent);
    taskButton.setAttribute('aria-pressed', String(hasTask));
    const hasBullets = lines.every((at) => state.bullets.some((item) => item.start === at));
    bulletButton.setAttribute('aria-pressed', String(hasBullets));
    indentButton.disabled = lines.every((at) => indentLevel(state.indents, at) >= MAX_INDENT);
    outdentButton.disabled = lines.every((at) => indentLevel(state.indents, at) === 0);
  }
  function render(focus = true) {
    surface.replaceChildren();
    let start = 0;
    for (const line of state.text.split('\n')) {
      const row = element('div', 'editable-line');
      row.style.setProperty('--indent-level', indentLevel(state.indents, start));
      row.dataset.editorLine = '';
      row.dataset.start = start;
      row.dataset.end = start + line.length;
      const task = state.tasks.find((t) => t.start === start),
        anchor = start;
      if (task) {
        const check = element('input', 'line-checkbox');
        check.type = 'checkbox';
        check.checked = task.done;
        check.contentEditable = 'false';
        check.setAttribute('aria-label', `Complete task: ${line || 'Empty line'}`);
        check.addEventListener('change', () => update(checkTask(state, anchor), selection));
        row.append(check);
      }
      if (!task && state.bullets.some((item) => item.start === start)) {
        const marker = element('span', 'bullet-marker', '•');
        marker.contentEditable = 'false';
        marker.setAttribute('aria-hidden', 'true');
        row.append(marker);
      }
      const text = element('span', 'editable-line-text');
      text.classList.toggle('task-completed', !!task?.done);
      const marks = state.format
        .filter((m) => m.start < start + line.length && m.end > start)
        .map((m) => ({
          ...m,
          start: Math.max(0, m.start - start),
          end: Math.min(line.length, m.end - start),
        }));
      renderFormatted(text, line, marks, { editable: true });
      if (!line) text.append(document.createElement('br'));
      row.append(text);
      surface.append(row);
      start += line.length + 1;
    }
    surface.dataset.empty = String(!state.text && !state.tasks.length && !state.bullets.length);
    refreshToolbar();
    if (focus) restoreSelection();
  }
  function update(next, nextSelection, remember = true) {
    if (remember) {
      past.push(snapshot());
      if (past.length > 100) past.shift();
      future.length = 0;
    }
    state = next;
    selection = { ...nextSelection };
    render();
    publish();
  }
  function replace(text, start = selection.start, end = selection.end) {
    if (text === '\n') {
      const next = insertLineBreak(state, start, end, typingStyle);
      update(next.state, { start: next.caret, end: next.caret });
      typingStyle = next.typingStyle;
      refreshToolbar();
    } else {
      const next = replaceText(state, start, end, text, typingStyle);
      const caret = start + text.length,
        recognized = text.length
          ? recognizeBullets(next, start, caret, { start: caret, end: caret })
          : { state: next, selection: { start: caret, end: caret } };
      update(recognized.state, recognized.selection);
    }
  }
  function format(key, value = true) {
    readSelection();
    const { start, end } = selection,
      line = lineRange(state.text, start);
    if (start === end && line.start === line.end) {
      const style = { ...(typingStyle || {}) };
      if (style[key] === value) delete style[key];
      else style[key] = value;
      typingStyle = style;
      refreshToolbar();
      restoreSelection();
    } else {
      const next = applyStyle(state, start, end, key, value);
      typingStyle = null;
      update(next, selection);
    }
  }
  for (const [name, key] of [
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Underline', 'underline'],
  ]) {
    const button = makeButton(name, `${name} selected text or current line`, () => format(key));
    button.className = `format-${key}`;
    buttons.push({ button, key, value: true });
    toolbar.append(button);
  }
  for (const color of Object.keys(HIGHLIGHTS)) {
    const button = makeButton(color[0].toUpperCase() + color.slice(1), `Highlight ${color}`, () =>
      format('highlight', color),
    );
    button.className = 'format-highlight';
    button.style.setProperty('--highlight', HIGHLIGHTS[color]);
    buttons.push({ button, key: 'highlight', value: color });
    toolbar.append(button);
  }
  const taskButton = makeButton('Add checkbox', 'Add checkbox', () => {
    readSelection();
    update(applyCheckbox(state, selection.start, selection.end), selection);
  });
  taskButton.className = 'format-task';
  toolbar.append(taskButton);
  const bulletButton = makeButton('• Bullets', 'Bullet list', () => {
    readSelection();
    update(toggleBullets(state, selection.start, selection.end), selection);
  });
  bulletButton.className = 'format-bullets';
  bulletButton.title = 'Bullet list · Or type - followed by a space at the start of a line';
  toolbar.append(bulletButton);
  function indent(delta) {
    readSelection();
    const next = applyIndent(state, selection.start, selection.end, delta);
    if (next !== state) update(next, selection);
    else restoreSelection();
  }
  const indentButton = makeButton('Indent →', 'Indent selected lines (Tab)', () => indent(1)),
    outdentButton = makeButton('← Outdent', 'Outdent selected lines (Shift+Tab)', () => indent(-1));
  toolbar.append(outdentButton, indentButton);
  const linkPanel = element('div', 'link-panel');
  linkPanel.hidden = true;
  const linkLabel = element('label', '', 'Web address'),
    linkInput = element('input');
  linkInput.type = 'text';
  linkInput.inputMode = 'url';
  linkInput.placeholder = 'https://example.com';
  linkInput.setAttribute('aria-label', 'Web address');
  linkLabel.append(linkInput);
  const linkError = element('p', 'field-hint');
  linkError.setAttribute('role', 'alert');
  let linkSelection = null;
  function closeLink() {
    linkPanel.hidden = true;
    linkSelection = null;
    restoreSelection();
  }
  const applyLink = makeButton('Apply link', 'Apply link', () => {
    const href = safeLink(linkInput.value);
    if (!href) {
      linkError.textContent = 'Enter a valid http or https web address.';
      linkInput.focus();
      return;
    }
    const { start, end } = linkSelection;
    let next = state,
      nextSelection = { start, end };
    if (start === end) {
      next = replaceText(state, start, end, linkInput.value.trim(), typingStyle);
      nextSelection.end = start + linkInput.value.trim().length;
    }
    next = {
      ...next,
      format: setLink(next.text, next.format, nextSelection.start, nextSelection.end, href),
    };
    typingStyle = null;
    linkPanel.hidden = true;
    linkSelection = null;
    update(next, nextSelection);
  });
  const removeLink = makeButton('Remove link', 'Remove link', () => {
    const { start, end } = linkSelection;
    const next = { ...state, format: setLink(state.text, state.format, start, end, null) };
    typingStyle = null;
    linkPanel.hidden = true;
    linkSelection = null;
    update(next, { start, end });
  });
  linkPanel.append(
    linkLabel,
    applyLink,
    removeLink,
    makeButton('Cancel', 'Cancel link editing', closeLink),
    linkError,
  );
  function openLink() {
    readSelection();
    linkSelection = { ...selection };
    const mark = state.format.find(
      (m) => m.href && m.start <= selection.start && m.end > selection.start,
    );
    if (selection.start === selection.end && mark)
      linkSelection = { start: mark.start, end: mark.end };
    linkInput.value =
      mark?.href || safeLink(state.text.slice(selection.start, selection.end)) || '';
    removeLink.hidden = !mark;
    linkError.textContent = '';
    linkPanel.hidden = false;
    linkInput.focus();
  }
  toolbar.append(makeButton('Link', 'Add or edit hyperlink', openLink));
  linkInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeLink();
    }
  });
  // Keep the caret and mobile keyboard in the editable text when a tool is tapped.
  toolbar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) event.preventDefault();
  });
  const compressionAbort = new AbortController();
  const attachments = element('section', 'attachment-editor'),
    fileInput = element('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.hidden = true;
  const upload = makeButton('Attach files', 'Upload attachments', () => fileInput.click()),
    fileStatus = element(
      'p',
      'field-hint',
      'Drop files here · Up to 10 files, 10 MB each · Larger PDFs and JPEG/PNG/WebP images can try size reduction · Stored on this device',
    );
  fileStatus.setAttribute('role', 'status');
  const filesHost = element('div');
  let uploading = false;
  function renderFiles() {
    filesHost.replaceChildren(
      attachmentList(state.attachments, (id) => {
        const previous = state.attachments;
        state = { ...state, attachments: previous.filter((item) => item.id !== id) };
        if (publish() === false) {
          state = { ...state, attachments: previous };
          fileStatus.textContent = 'Could not save this change. Please try again.';
        }
        renderFiles();
      }),
    );
  }
  async function uploadFiles(files) {
    if (uploading) return;
    uploading = true;
    upload.disabled = true;
    fileStatus.textContent = 'Saving files…';
    try {
      if (state.attachments.length + files.length > 10)
        throw new Error('Use up to 10 attachments per note.');
      const prepared = await prepareUploadFiles(files, (file) =>
        reviewCompression(file, attachments, compressionAbort.signal),
      );
      if (!prepared) {
        fileStatus.textContent = 'Upload cancelled. No files were added.';
        return;
      }
      if (destroyed) return;
      const added = await addFiles(prepared, state.attachments);
      if (destroyed) {
        alert(
          'The note was closed before the upload finished. Reopen the note to attach your files.',
        );
        return;
      }
      const previous = state.attachments;
      state = { ...state, attachments: [...previous, ...added] };
      if (publish() === false) {
        state = { ...state, attachments: previous };
        throw new Error('Could not save the note. Free browser storage and try again.');
      }
      renderFiles();
      fileStatus.textContent =
        'Files saved on this device. Include them in a Dayline backup to transfer them.';
    } catch (error) {
      fileStatus.textContent = error.message;
    } finally {
      uploading = false;
      upload.disabled = false;
      fileInput.value = '';
      if (pendingClose && !destroyed) {
        pendingClose = false;
        closeOutside();
      }
    }
  }
  fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
  wrapper.addEventListener('dragover', (event) => {
    if ([...event.dataTransfer.types].includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      attachments.classList.add('file-drop-active');
    }
  });
  wrapper.addEventListener('dragleave', (event) => {
    if (!wrapper.contains(event.relatedTarget)) attachments.classList.remove('file-drop-active');
  });
  wrapper.addEventListener('drop', (event) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    attachments.classList.remove('file-drop-active');
    uploadFiles(event.dataTransfer.files);
  });
  attachments.append(upload, fileInput, fileStatus, filesHost);
  renderFiles();
  controls.append(
    makeButton('Done', 'Close note editor', () => {
      closeOutside();
    }),
  );
  controls.lastChild.className = 'primary';
  if (onRepeat)
    controls.prepend(
      makeButton('Repeat', 'Repeat note', () => {
        if (uploading || composing) return;
        flush();
        onRepeat();
      }),
    );
  if (entry?.id && onDuplicate)
    controls.prepend(
      makeButton('Duplicate', 'Duplicate note', () => {
        if (uploading || composing) return;
        flush();
        if (onDuplicate() !== false && !destroyed) onDone();
      }),
    );
  wrapper.append(
    titleLabel,
    timeLabel,
    noteType.element,
    toolbar,
    linkPanel,
    surface,
    attachments,
    controls,
  );
  function undo(redo = false) {
    const source = redo ? future : past,
      target = redo ? past : future;
    if (!source.length) return;
    target.push(snapshot());
    const previous = source.pop();
    state = {
      ...previous.state,
      title: state.title,
      minute: state.minute,
      noteType: state.noteType,
      tags: state.tags,
      attachments: state.attachments,
    };
    selection = previous.selection;
    typingStyle = previous.typingStyle;
    render();
    publish();
  }
  function deletion(backward, word = false) {
    let { start, end } = selection;
    if (start === end) {
      if (word) {
        if (backward) {
          const match = state.text.slice(0, start).match(/\s*\S+\s*$/u);
          start -= match?.[0].length || 0;
        } else {
          const match = state.text.slice(end).match(/^\s*\S+\s*/u);
          end += match?.[0].length || 0;
        }
      } else if (backward) {
        start -= Array.from(state.text.slice(0, start)).at(-1)?.length || 0;
      } else end += Array.from(state.text.slice(end))[0]?.length || 0;
    }
    replace('', start, end);
  }
  surface.addEventListener('beforeinput', (event) => {
    if (composing || event.isComposing) return;
    readSelection();
    const type = event.inputType;
    if (type === 'insertText' || type === 'insertReplacementText') {
      if (event.data === null) return;
      event.preventDefault();
      replace(event.data);
    } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
      event.preventDefault();
      replace('\n');
    } else if (
      [
        'deleteContentBackward',
        'deleteContentForward',
        'deleteWordBackward',
        'deleteWordForward',
      ].includes(type)
    ) {
      event.preventDefault();
      deletion(type.endsWith('Backward'), type.includes('Word'));
    } else if (type === 'formatIndent' || type === 'formatOutdent') {
      event.preventDefault();
      indent(type === 'formatIndent' ? 1 : -1);
    } else if (type === 'historyUndo' || type === 'historyRedo') {
      event.preventDefault();
      undo(type === 'historyRedo');
    } else if (['formatBold', 'formatItalic', 'formatUnderline'].includes(type)) {
      event.preventDefault();
      format({ formatBold: 'bold', formatItalic: 'italic', formatUnderline: 'underline' }[type]);
    }
  });
  surface.addEventListener('paste', (event) => {
    event.preventDefault();
    readSelection();
    replace((event.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n'));
  });
  surface.addEventListener('cut', (event) => {
    readSelection();
    if (selection.start === selection.end) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', state.text.slice(selection.start, selection.end));
    replace('');
  });
  surface.addEventListener('drop', (event) => event.preventDefault());
  surface.addEventListener('keydown', (event) => {
    if (
      event.key === 'Tab' &&
      !event.target.closest('input,button,a') &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !composing &&
      !event.isComposing
    ) {
      event.preventDefault();
      indent(event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        openLink();
      } else if (['b', 'i', 'u'].includes(key)) {
        event.preventDefault();
        format({ b: 'bold', i: 'italic', u: 'underline' }[key]);
      } else if (key === 'z' || key === 'y') {
        event.preventDefault();
        readSelection();
        undo(key === 'y' || event.shiftKey);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        closeOutside();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeOutside();
    }
  });
  // IME, dictation and browser-specific edits can run natively, then normalize to
  // the same safe model. Never rebuild the DOM in the middle of composition.
  function nativeText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches('input,[contenteditable=false]'))
      return '';
    if (node.tagName === 'BR') return '\n';
    const children = [...node.childNodes];
    if (children.length === 1 && children[0].nodeName === 'BR') return '';
    let result = '';
    children.forEach((child, index) => {
      if (
        index &&
        child.nodeType === Node.ELEMENT_NODE &&
        /^(DIV|P)$/.test(child.tagName) &&
        !result.endsWith('\n')
      )
        result += '\n';
      result += nativeText(child);
    });
    return result;
  }
  function syncNative() {
    const rows = [...surface.childNodes];
    const text = rows.every(
      (row) => row.nodeType === Node.ELEMENT_NODE && row.hasAttribute('data-editor-line'),
    )
      ? rows.map(nativeText).join('\n')
      : nativeText(surface);
    if (text === state.text) return;
    readSelection();
    const next = {
      ...state,
      text,
      format: editFormat(state.text, text, state.format),
      tasks: editTasks(state.text, text, state.tasks),
      bullets: editBullets(state.text, text, state.bullets),
      indents: editIndents(state.text, text, state.indents),
    };
    let first = 0,
      last = text.length;
    while (first < state.text.length && first < text.length && state.text[first] === text[first])
      first++;
    let oldLast = state.text.length;
    while (last > first && oldLast > first && text[last - 1] === state.text[oldLast - 1]) {
      last--;
      oldLast--;
    }
    const caret = Math.min(text.length, selection.end),
      recognized = recognizeBullets(next, first, last, { start: caret, end: caret });
    update(recognized.state, recognized.selection);
  }
  surface.addEventListener('compositionstart', () => {
    composing = true;
  });
  surface.addEventListener('compositionend', () => {
    composing = false;
    syncNative();
    if (pendingClose) {
      pendingClose = false;
      queueMicrotask(closeOutside);
    }
  });
  surface.addEventListener('input', () => {
    if (!composing) syncNative();
  });
  const onSelection = () => {
    if (!destroyed && !composing) readSelection();
  };
  document.addEventListener('selectionchange', onSelection);
  function flush() {
    if (!composing) syncNative();
  }
  function closeOutside() {
    if (destroyed || !wrapper.isConnected) return;
    if (composing || uploading) {
      pendingClose = true;
      return;
    }
    flush();
    onDone();
  }
  const onPointerStart = (event) => {
    pointerStartedInside = wrapper.contains(event.target);
  };
  const onOutsideClick = (event) => {
    const startedInside = event.detail > 0 && pointerStartedInside;
    pointerStartedInside = false;
    if (destroyed || wrapper.contains(event.target) || startedInside) return;
    // Let the clicked control act first; it may navigate or open a different note.
    queueMicrotask(closeOutside);
  };
  document.addEventListener('pointerdown', onPointerStart, true);
  document.addEventListener('click', onOutsideClick, true);
  render(false);
  return {
    element: wrapper,
    focus: restoreSelection,
    attachFiles: uploadFiles,
    flush,
    destroy() {
      destroyed = true;
      compressionAbort.abort();
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('pointerdown', onPointerStart, true);
      document.removeEventListener('click', onOutsideClick, true);
    },
  };
}
