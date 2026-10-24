import { node } from '../../shared/dom.js?v=5684b4e7c19b';
import { PERSONALITIES, personality } from '../../personalities/index.js?v=5684b4e7c19b';
import { musicProfile } from './music.js?v=5684b4e7c19b';
import { FocusAudio } from './audio.js?v=5684b4e7c19b';
import { restoreAudioSettings } from './settings.js?v=5684b4e7c19b';
const defaults = {
  binaural: false,
  ambient: true,
  warmAmbient: false,
  metronome: false,
  beat: 10,
  bpm: 80,
  tonesVolume: 30,
  ambientVolume: 35,
  warmVolume: 35,
  metronomeVolume: 50,
};
const KEY = 'dayline.focus-audio.v1';
const button = (text, action, className = 'secondary') => {
  const el = node('button', className, text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
export function setupFocusAudio({ audio = new FocusAudio(), storage = localStorage } = {}) {
  const launch = document.querySelector('#launch-focus-audio');
  const dialog = node('dialog', 'focus-audio-window');
  dialog.setAttribute('aria-labelledby', 'focus-audio-title');
  document.body.append(dialog);
  let error = '',
    audioPersonality = personality(),
    raw;
  try {
    raw = JSON.parse(storage.getItem(KEY) || 'null');
    // Read legacy mixer preferences once, without modifying its session draft.
    if (!raw) raw = JSON.parse(storage.getItem('dayline.focus.v1') || 'null')?.audio;
  } catch {}
  let audioSettings = restoreAudioSettings(raw, defaults, audioPersonality);
  function save() {
    try {
      storage.setItem(
        KEY,
        JSON.stringify({ ...audioSettings, soundtrackPersonality: audioPersonality }),
      );
    } catch {
      error = 'Audio preferences apply in this tab, but could not be saved on this device.';
      status();
    }
  }
  function status() {
    const el = dialog.querySelector('.focus-audio-status');
    if (el) el.textContent = error;
  }
  function buttons() {
    launch.textContent = audio.playing ? 'Focus Audio · Playing' : 'Launch Focus Audio';
    const toggle = dialog.querySelector('.focus-audio-playback');
    if (toggle) toggle.textContent = audio.playing ? 'Pause audio' : 'Play audio';
  }
  function minimize() {
    dialog.close();
    buttons();
  }
  function render() {
    const title = node('h1', '', 'Focus Audio');
    title.id = 'focus-audio-title';
    const statusLine = node('p', 'focus-audio-status', error);
    statusLine.setAttribute('role', 'status');
    const header = node('div', 'focus-window-header');
    header.append(
      node('span', 'eyebrow', 'DAYLINE · FOCUS AUDIO'),
      button('Minimize audio', minimize),
    );
    dialog.replaceChildren(
      header,
      title,
      node(
        'p',
        'field-hint',
        'Your own listening space. Play independently of Focus Mode; minimizing this player or finishing a session keeps audio playing.',
      ),
      statusLine,
      audioSection(),
    );
  }
  function open() {
    render();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function audioSection() {
    const section = node('section', 'focus-section'),
      description = node('p', 'field-hint');
    function updateDescription() {
      description.textContent =
        musicProfile(audioSettings.soundtrack).description +
        ' Music and warm ambience work through speakers or headphones. Mix any layers you like. Warm ambient sound is the original soft background layer, available with or without music in every layout. Binaural tones use separate left and right channels for headphones. The metronome tempo is independent of the soundtrack.';
    }
    updateDescription();
    section.append(node('h2', '', 'Focus audio'), description);
    section.append(
      node(
        'p',
        'field-hint',
        'Suggested starting points to experiment with (binaural difference · metronome tempo):',
      ),
    );
    const suggestions = node('ul', 'field-hint focus-audio-presets'),
      presetButtons = [],
      tempoControls = new Map();
    for (const [name, copy, beat, bpm] of [
      ['Gentle', 'Gentle reflection or brainstorming: 6 Hz · 60 BPM.', 6, 60],
      ['Relaxed', 'Relaxed, steady writing or reading: 10 Hz · 80 BPM.', 10, 80],
      ['Brisk', 'A brisk rhythm for routine tasks: 14 Hz · 100 BPM.', 14, 100],
    ]) {
      const item = node('li'),
        apply = button('Use ' + name.toLowerCase(), () => {
          audioSettings.beat = beat;
          audioSettings.bpm = bpm;
          syncTempos();
          changeAudio();
        });
      apply.setAttribute('aria-label', `Use ${name.toLowerCase()}: ${beat} Hz and ${bpm} BPM`);
      presetButtons.push({ apply, beat, bpm });
      item.append(node('span', '', copy), apply);
      suggestions.append(item);
    }
    function syncTempos() {
      for (const [key, inputs] of tempoControls)
        for (const input of inputs) input.value = audioSettings[key];
      for (const { apply, beat, bpm } of presetButtons)
        apply.setAttribute(
          'aria-pressed',
          String(audioSettings.beat === beat && audioSettings.bpm === bpm),
        );
    }
    section.append(
      suggestions,
      node(
        'p',
        'field-hint',
        'These are optional listening ideas, not scientifically established recipes for flow. Evidence for binaural brainwave entrainment is mixed; no frequency or BPM guarantees a mental state. Hz is the difference between the two ear tones; BPM controls the separate metronome. Adjust either independently, or turn a layer off.',
      ),
    );
    const action = button(
      audio.playing ? 'Pause audio' : 'Play audio',
      async () => {
        action.disabled = true;
        try {
          save();
          if (audio.playing) await audio.fadeOut();
          else await audio.play({ ...audioSettings, layout: audioSettings.soundtrack });
          action.textContent = audio.playing ? 'Pause audio' : 'Play audio';
          buttons();
        } catch (e) {
          error = e.message;
          status();
        } finally {
          action.disabled = false;
          buttons();
        }
      },
      'primary focus-audio-playback',
    );
    for (const [key, label, volume] of [
      ['binaural', 'Binaural tones', 'tonesVolume'],
      ['ambient', 'Soundtrack', 'ambientVolume'],
      ['warmAmbient', 'Warm ambient sound', 'warmVolume'],
      ['metronome', 'Steady metronome', 'metronomeVolume'],
    ]) {
      const row = node('div', 'focus-audio-row'),
        toggleLabel = node('label', ''),
        toggle = node('input');
      toggle.type = 'checkbox';
      toggle.checked = audioSettings[key];
      toggleLabel.append(toggle, document.createTextNode(' ' + label));
      if (key === 'ambient') {
        const select = node('select', 'focus-soundtrack-select');
        select.setAttribute('aria-label', 'Focus soundtrack');
        for (const { id: layout, name } of Object.values(PERSONALITIES)) {
          const profile = musicProfile(layout),
            option = node(
              'option',
              '',
              profile.label + (layout === personality() ? ` · ${name} default` : ''),
            );
          option.value = layout;
          select.append(option);
        }
        select.value = audioSettings.soundtrack;
        select.addEventListener('change', () => {
          audioSettings.soundtrack = select.value;
          updateDescription();
          changeAudio();
        });
        const group = node('div', 'focus-soundtrack-choice');
        group.append(toggleLabel, select);
        row.append(group);
      } else row.append(toggleLabel);
      toggle.addEventListener('change', () => {
        audioSettings[key] = toggle.checked;
        changeAudio();
      });
      const range = node('input');
      range.type = 'range';
      range.min = 0;
      range.max = 100;
      range.value = audioSettings[volume];
      range.setAttribute('aria-label', label + ' volume');
      range.addEventListener('input', () => {
        audioSettings[volume] = Number(range.value);
        changeAudio();
      });
      row.append(range);
      section.append(row);
    }
    for (const [key, label, min, max] of [
      ['bpm', 'Metronome tempo (BPM)', 30, 180],
      ['beat', 'Binaural frequency difference (Hz)', 2, 15],
    ]) {
      const row = node('div', 'focus-tempo-control'),
        labelNode = node('label', '', label),
        range = node('input'),
        input = node('input');
      range.type = 'range';
      input.type = 'number';
      input.required = true;
      range.id = 'focus-tempo-' + key;
      labelNode.htmlFor = range.id;
      for (const control of [range, input]) {
        control.min = min;
        control.max = max;
        control.step = 1;
        control.value = audioSettings[key];
      }
      range.setAttribute('aria-label', label + ' slider');
      input.setAttribute('aria-label', label);
      range.setAttribute('aria-describedby', 'focus-preset-help');
      input.setAttribute('aria-describedby', 'focus-preset-help');
      tempoControls.set(key, [range, input]);
      range.addEventListener('input', () => {
        audioSettings[key] = Number(range.value);
        syncTempos();
        changeAudio();
      });
      input.addEventListener('change', () => {
        if (!input.reportValidity()) return;
        audioSettings[key] = Number(input.value);
        syncTempos();
        changeAudio();
      });
      row.append(labelNode, range, input);
      section.append(row);
    }
    const help = node(
      'p',
      'field-hint',
      'Presets update both sliders. Fine-tune either value below; layer switches stay as you set them.',
    );
    help.id = 'focus-preset-help';
    section.append(help);
    syncTempos();
    async function changeAudio() {
      save();
      if (audio.playing) {
        try {
          await audio.play({ ...audioSettings, layout: audioSettings.soundtrack });
        } catch (e) {
          error = e.message;
          status();
        } finally {
          buttons();
        }
      }
    }
    section.append(action);
    return section;
  }

  launch.addEventListener('click', open);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    minimize();
  });
  let backdropPress = false;
  function onBackdrop(event) {
    const r = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    );
  }
  dialog.addEventListener('pointerdown', (event) => {
    backdropPress = event.isPrimary && event.button === 0 && onBackdrop(event);
  });
  dialog.addEventListener('pointerup', (event) => {
    if (backdropPress && onBackdrop(event)) minimize();
    backdropPress = false;
  });
  dialog.addEventListener('pointercancel', () => {
    backdropPress = false;
  });
  window.addEventListener('dayline:appearance', () => {
    const next = personality();
    if (next !== audioPersonality) {
      audioPersonality = next;
      audioSettings.soundtrack = musicProfile(next).layout;
      save();
      if (audio.playing)
        audio.play({ ...audioSettings, layout: audioSettings.soundtrack }).catch((e) => {
          error = e.message;
          status();
          buttons();
        });
    }
    if (dialog.open) render();
  });
  window.addEventListener('pagehide', () => audio.stop());
  buttons();
  return {
    open,
    minimize,
    get playing() {
      return audio.playing;
    },
  };
}
