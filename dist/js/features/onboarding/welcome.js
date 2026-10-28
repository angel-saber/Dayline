import { PERSONALITIES, getPersonality } from '../../personalities/index.js?v=ca08f99f62a3';
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
    <p class="field-hint">Plan a workday, study session, personal project, or a little space for yourself.</p>
    <ul class="welcome-features">
      <li><h3>Plan your day</h3><p>Choose preset or custom intervals and available hours. Add multiple titled notes with exact times; check them off, duplicate, reschedule, or drag them between intervals.</p></li>
      <li><h3>Make notes your own</h3><p>Write plans, journals, and checklists with formatting, highlights, bullets, checkboxes, indentation, and links. Add tags and attach files; changes save as you write.</p></li>
      <li><h3>See your month</h3><p>Browse color-coded notes and undated Weekly Notes. Tap a date to add several notes with titles, times, tags, and details. Expand a day to view its intervals, move notes, or delete them.</p></li>
      <li><h3>Organize and share</h3><p>Select notes across a day, week, or month to move, tag, delete, or share together. Preview a single note or collection, order by date or category, or share open time as availability.</p></li>
      <li><h3>Make space to focus</h3><p>Start a Focus session with a mantra, interval notes, inspiration, and an interruption log. Minimize it while you work, then finish with an optional reflection and saved summary.</p></li>
      <li><h3>Choose your atmosphere</h3><p>Explore six personalities, each with its own look, voice, and default soundtrack. Launch Focus Audio independently and mix music, ambience, binaural tones, or a metronome.</p></li>
      <li><h3>Find your next step</h3><p>Start your day with a short visualization, or open More for Guided Visualization, guided breathing, planning, Untangle My Thoughts, The Two-Minute Start, and Monthly Compass. Planning activities can save reports to your notes.</p></li>
      <li><h3>Find inspiration</h3><p>Explore real stories and role models in the Inspiration Library. Search or filter by need and field, save favorites on this device, or add a story to Daily.</p></li>
      <li><h3>Stay on track</h3><p>Turn on reminders and sound for planned notes. Use Shortcuts to open Google Meet or Drive, or add links to your own favorite websites.</p></li>
    </ul>
    <details class="welcome-more"><summary>More about planning, sharing, and storage</summary>
      <p>In Monthly, double-tap a date to open Daily. Monthly Compass can create four undated Weekly Notes with your weekly project tasks. In Settings, choose whether to hide times outside your available hours.</p>
      <p>Share notes with anyone without requiring a Dayline account. Reports and attachments are off by default; file sharing depends on your browser and the receiving app. Preview supported attachments, and optionally try compressing large PDFs or JPEG, PNG, and WebP images.</p>
      <p>Share Availability starts with your available hours, lets you adjust the selection, and excludes intervals that have begun. Reminder permissions and sound activation are set on each device; keep Dayline open for browser reminders.</p>
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
    <p class="field-hint welcome-footnote">You can change these choices anytime in Settings. Guest notes stay in this browser; invited account users can sync notes and settings across devices. Attachment files stay on this device and do not sync automatically. Download a backup in Settings to keep a copy or transfer files.</p>
    <p class="welcome-error" role="status"></p><div class="inline"><button class="primary welcome-confirm" type="button">Start my day</button><button class="secondary welcome-cancel" type="button" hidden>Cancel</button></div>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => window.dispatchEvent(new Event('dayline:welcome-closed')));
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
