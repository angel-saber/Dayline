import { PERSONALITIES, getPersonality } from '../../personalities/index.js?v=bb7124230ebb';
// First-visit setup stays separate from planner data and personality presentation.
const KEY = 'dayline.welcome.v1';
export function needsWelcome(storage, entryComplete = false, loginVisible = true) {
  if (!entryComplete || loginVisible) return false;
  try {
    return storage.getItem(KEY) !== 'done';
  } catch {
    return true;
  }
}
export function setupWelcome(api) {
  const dialog = document.createElement('dialog');
  dialog.className = 'welcome-window';
  dialog.setAttribute('aria-labelledby', 'welcome-title');
  dialog.innerHTML = `<div class="eyebrow">WELCOME TO DAYLINE</div><h1 id="welcome-title">A little room for your day.</h1>
    <p class="welcome-intro">A simple place to plan, think, and make steady progress—one time interval at a time.</p>
    <section class="welcome-overview" aria-labelledby="welcome-features-title"><h2 id="welcome-features-title">One place for plans, progress, and perspective</h2>
    <p class="field-hint">Plan a workday or study session, keep track of errands and events, journal a thought, or turn a personal project into steady weekly steps.</p>
    <ul class="welcome-features">
      <li><h3>Plan your day your way</h3><p>Set your available hours in Settings and optionally hide earlier or later times in Daily. Choose preset or custom intervals, add multiple notes to a slot, and give each note a title and exact time. Navigate any day, check off finished notes, swipe to complete or delete, and drag to reschedule.</p></li>
      <li><h3>Make notes useful</h3><p>Write plans, journals, checklists, or meeting notes with bold, italic, underline, colored highlights, bullets, checkboxes, and clickable links. Changes save as you write or click away.</p></li>
      <li><h3>See the bigger picture</h3><p>Browse note titles across the weeks in Monthly. Keep undated ideas and tasks in each week’s Weekly Notes, then schedule them when ready. Tap a date to add a title and time, double-tap to open Daily, or drag notes between dates. Use Share availability to select empty intervals using editable available hours from Settings and share merged time ranges with a time zone, without revealing your notes. Optional reminders with sound notify at a note’s exact time; click one to jump to its interval.</p></li>
      <li><h3>Organize without extra work</h3><p>Combine Project, Admin, Event, Personal, and custom tags on a note. Select notes individually or by category across a day, week, or month, then move, tag, delete, or share them together. Manage your tags in Settings.</p></li>
      <li><h3>Protect a little focus</h3><p>Commit to a mantra, work with all notes in your current interval, edit them directly, and capture interruptions. Minimize your session, follow the next interval, or extend unfinished work. Finish with an optional reflection and a saved session report.</p></li>
      <li><h3>Set the atmosphere</h3><p>Choose Zen, Builder, Founder, Poet, Astronaut, or Gamer for a different look, voice, and default soundtrack, with a fresh quote each day. Choose Full, Subtle, or Off visual effects in Settings; reduced-motion preferences are respected. Launch Focus Audio independently, with or without a Focus session. Minimize the player while listening and pause it separately when ready. Switch between Still Temple, Cyberpunk Mission, Symphonic Horizon, Undertow, Orbital Drift, and Next Level; mix warm ambience, headphone binaural tones, and an independent metronome.</p></li>
      <li><h3>Find a starting point</h3><p>Open More for Guided Breathing, Guided Planning, Untangle My Thoughts, The Two-Minute Start, and Monthly Compass. Calm or energize, clarify your next action, or plan projects across work, health, learning, relationships, and spirituality.</p></li>
      <li><h3>Keep and share what matters</h3><p>Upload or drop files onto notes. Click a filename to preview images, PDFs, text, or browser-supported audio/video without downloading; Download stays separate, with a fallback for unsupported formats. Oversized PDFs and JPEG/PNG/WebP images can try optional compression, with a smaller copy to review. Share one note or a collection, preview included content, and organize by date or category. Reports and attachments are off by default; recipients need no Dayline account.</p></li>
    </ul>
    <details class="welcome-more"><summary>A little more about guided activities and sharing</summary>
      <p>Guided Planning records one activity per life dimension for today. Untangle My Thoughts sorts what you can act on, ask about, or leave for later. The Two-Minute Start helps you try one tiny action.</p>
      <p>Monthly Compass chooses one project per life dimension and one task per project for each of four weeks. Optionally add four undated Weekly Notes in Monthly, starting with the current week. Planning activities save expandable reports into your current note; breathing offers two-minute animated exercises.</p>
      <p>Use Share… to send text and optional files through supported email or messaging apps. Copy text and Email text only do not attach files; downloads are available when file sharing is unsupported. Attach up to 10 files per note, 10 MB each. Compression keeps the original format and leaves the source file untouched; not every file can shrink enough.</p>
    </details></section>
    <section class="welcome-step"><h2>Choose your rhythm</h2><label for="welcome-interval">Time intervals</label><select id="welcome-interval"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60" selected>1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="custom">Custom</option></select><div id="welcome-custom-wrap" hidden><label for="welcome-custom">Custom interval in minutes</label><input id="welcome-custom" type="number" min="1" max="1440" step="1" value="60" required></div></section>
    <section class="welcome-step"><h2>Choose your atmosphere</h2><p class="field-hint">Preview a personality. The look and voice change together.</p><fieldset class="welcome-personalities"><legend class="sr-only">Dayline personality</legend>
    ${Object.values(PERSONALITIES)
      .map(
        (value) =>
          `<label><input type="radio" name="welcome-personality" value="${value.id}"${value.id === 'zen' ? ' checked' : ''}><strong>${value.name}</strong><span>${value.description}</span></label>`,
      )
      .join('')}</fieldset>
    <p class="welcome-preview" aria-live="polite"></p></section>
    <p class="field-hint welcome-footnote">You can change these choices anytime in Settings. Notes and attachment files are saved in this browser on this device. Download a backup in Settings to keep a copy or transfer them; attachment files do not automatically sync across devices.</p>
    <p class="welcome-error" role="status"></p><div class="inline"><button class="primary welcome-confirm" type="button">Start my day</button><button class="secondary welcome-cancel" type="button" hidden>Cancel</button></div>`;
  document.body.append(dialog);
  const $ = (selector) => dialog.querySelector(selector),
    interval = $('#welcome-interval'),
    custom = $('#welcome-custom');
  let original = 'zen',
    manual = false,
    closing = false;
  function selected() {
    return $('input[name="welcome-personality"]:checked').value;
  }
  function preview() {
    const mode = selected(),
      copy = getPersonality(mode).welcome;
    window.dispatchEvent(new CustomEvent('dayline:preview-layout', { detail: mode }));
    $('#welcome-title').textContent = copy.title;
    $('.welcome-intro').textContent = copy.intro;
    $('.welcome-preview').textContent = copy.quote;
  }
  interval.addEventListener('change', () => {
    $('#welcome-custom-wrap').hidden = interval.value !== 'custom';
  });
  dialog
    .querySelectorAll('input[name="welcome-personality"]')
    .forEach((input) => input.addEventListener('change', preview));
  function open(revisit = false) {
    if (dialog.open || closing || !api.canOpen()) return;
    if (!revisit) api.showDaily();
    manual = revisit;
    original = document.documentElement.dataset.layout || 'zen';
    const minutes = revisit ? api.getState().settings.interval : 60;
    interval.value = [15, 30, 60, 120, 240].includes(minutes) ? String(minutes) : 'custom';
    custom.value = minutes;
    $('#welcome-custom-wrap').hidden = interval.value !== 'custom';
    dialog.querySelector(`input[value="${revisit ? original : 'zen'}"]`).checked = true;
    $('.welcome-cancel').hidden = !revisit;
    $('.welcome-error').textContent = '';
    preview();
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  function cancel() {
    if (closing || !manual) return;
    window.dispatchEvent(new CustomEvent('dayline:preview-layout', { detail: original }));
    dialog.close();
  }
  $('.welcome-cancel').addEventListener('click', cancel);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancel();
  });
  $('.welcome-confirm').addEventListener('click', () => {
    const minutes = Number(interval.value === 'custom' ? custom.value : interval.value);
    if (interval.value === 'custom' && !custom.reportValidity()) return;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
    if (!api.saveInterval(minutes)) {
      $('.welcome-error').textContent =
        'Your browser could not save your choices. Please try again.';
      return;
    }
    window.dispatchEvent(new CustomEvent('dayline:set-layout', { detail: selected() }));
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      api.toast(
        'Setup applied for this visit. Your browser could not remember that setup is complete.',
      );
    }
    closing = true;
    dialog.classList.add('welcome-leaving');
    $('.welcome-confirm').disabled = true;
    const finish = () => {
      dialog.close();
      dialog.classList.remove('welcome-leaving');
      $('.welcome-confirm').disabled = false;
      closing = false;
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else setTimeout(finish, 420);
  });
  document.querySelector('#reopen-welcome').addEventListener('click', () => open(true));
  function checkEntry() {
    if (!api.canOpen()) {
      if (dialog.open) {
        window.dispatchEvent(new CustomEvent('dayline:preview-layout', { detail: original }));
        dialog.close();
      }
      return;
    }
    try {
      if (needsWelcome(localStorage, true, false)) open();
    } catch {
      open();
    }
  }
  window.addEventListener('dayline:entry-view', checkEntry);
  checkEntry();
  return { open };
}
