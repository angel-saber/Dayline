import {
  availableHours,
  validAvailableHours,
  hourInput,
  inputMinute,
} from './available-hours.js?v=e84921dfd9a4';
const $ = (selector) => document.querySelector(selector);
export function setupSettings({
  getState,
  persist,
  toast,
  getReminders,
  renderTags,
  onIntervalChange,
  onHoursChange,
}) {
  function renderSettings() {
    renderTags();
    const s = getState().settings,
      isPreset = [15, 30, 60, 120, 240].includes(s.interval);
    $('#interval').value = isPreset ? s.interval : 'custom';
    $('#custom-field').hidden = isPreset;
    $('#custom-minutes').value = s.interval;
    $('#clock').value = s.clock;
    $('#notifications').checked = s.notifications;
    $('#sound').checked = s.sound;
    const hours = availableHours(s);
    $('#available-from').value = hourInput(hours.from);
    $('#available-until').value = hourInput(hours.to);
    $('#hide-before-hours').checked = hours.hideBefore;
    $('#hide-after-hours').checked = hours.hideAfter;
    notificationStatus();
  }
  function notificationStatus() {
    const state = getState(),
      reminders = getReminders();
    let status =
      'Keep Dayline open. Sounds can play while you use another tab after audio is activated here. Browsers may delay or suspend background reminders, especially on a locked phone. Closed-tab alerts are not supported; device settings may silence sounds.';
    if (!globalThis.Notification)
      status += ' System notifications are unavailable here; in-app reminders still work.';
    else if (Notification.permission === 'denied')
      status +=
        ' System notifications are blocked in browser settings; in-app reminders still work.';
    else if (state.settings.notifications && Notification.permission === 'default')
      status += ' Allow notifications on this device to see system alerts.';
    $('#notification-permission').hidden =
      !state.settings.notifications ||
      !globalThis.Notification ||
      Notification.permission !== 'default';
    $('#notification-status').textContent = status;
    $('#sound-status').textContent = !state.settings.sound
      ? 'Reminder sound is off. Turn on Play a sound to hear planned-note reminders.'
      : reminders.audioReady
        ? 'Reminder player is enabled in this tab. Planned notes use this same player.'
        : 'Sound is enabled. Click Test sound to activate audio in this tab.';
  }
  function setIntervalLength(value) {
    const state = getState();
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      toast('Choose a whole number from 1 to 1440 minutes.');
      return;
    }
    state.settings.interval = value;
    onIntervalChange();
    persist();
    renderSettings();
    toast('Timeline updated. All your notes are kept.');
  }
  $('#interval').onchange = (e) => {
    if (e.target.value === 'custom') {
      $('#custom-field').hidden = false;
      $('#custom-minutes').focus();
    } else setIntervalLength(Number(e.target.value));
  };
  $('#apply-custom').onclick = () => setIntervalLength(Number($('#custom-minutes').value));
  $('#clock').onchange = (e) => {
    getState().settings.clock = e.target.value;
    persist();
  };
  function saveAvailableHours() {
    const state = getState();
    if (!$('#available-from').reportValidity() || !$('#available-until').reportValidity())
      return false;
    const previous = state.settings;
    try {
      const hours = validAvailableHours({
        from: inputMinute($('#available-from').value),
        to: inputMinute($('#available-until').value, true),
        hideBefore: $('#hide-before-hours').checked,
        hideAfter: $('#hide-after-hours').checked,
      });
      state.settings = { ...previous, availableHours: hours };
      if (!persist()) {
        state.settings = previous;
        renderSettings();
        return false;
      }
      onHoursChange();
      $('#available-hours-status').textContent =
        'Available hours saved. Daily visibility and sharing defaults updated.';
      return true;
    } catch (error) {
      $('#available-hours-status').textContent = error.message;
      return false;
    }
  }
  $('#save-available-hours').onclick = saveAvailableHours;
  for (const selector of ['#hide-before-hours', '#hide-after-hours'])
    $(selector).onchange = () => {
      if (!saveAvailableHours()) {
        const hours = availableHours(getState().settings);
        $('#hide-before-hours').checked = hours.hideBefore;
        $('#hide-after-hours').checked = hours.hideAfter;
      }
    };
  $('#notifications').onchange = async (e) => {
    getState().settings.notifications = e.target.checked;
    persist();
    if (e.target.checked && globalThis.Notification?.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        toast('System notification permission is unavailable. In-app reminders are enabled.');
      }
    }
    notificationStatus();
  };
  $('#notification-permission').onclick = async () => {
    try {
      await Notification.requestPermission();
    } catch {
      toast('Notification permission is unavailable in this browser.');
    }
    notificationStatus();
  };
  $('#sound').onchange = async (e) => {
    getState().settings.sound = e.target.checked;
    if (e.target.checked) {
      try {
        await getReminders().chime();
      } catch (error) {
        toast(error.message);
      }
    }
    persist();
    renderSettings();
  };
  $('#test-sound').onclick = async () => {
    const test = $('#test-sound');
    test.disabled = true;
    try {
      await getReminders().chime();
      toast(
        getState().settings.sound
          ? 'Test chime played. If silent, check device volume and whether this tab is muted.'
          : 'Test chime played. Turn on Play a sound to use it for reminders.',
      );
    } catch (error) {
      toast(error.message);
    } finally {
      test.disabled = false;
      notificationStatus();
    }
  };
  return { render: renderSettings, notificationStatus };
}
