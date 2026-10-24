/* Generated from the personality registry. Edit scripts/appearance.template.txt. */
/* Apply appearance immediately; account sync listens only to committed changes. */
(() => {
  const themes = {
    zen: '#f5f4ef',
    builder: '#0b111b',
    founder: '#eee5d6',
    poet: '#17171c',
    astronaut: '#080f22',
    gamer: '#100d1d',
  };
  const key = 'dayline.appearance.v1',
    layouts = Object.keys(themes);
  let current = 'zen';
  try {
    const saved = localStorage.getItem(key);
    if (layouts.includes(saved)) current = saved;
  } catch {}
  function apply(value) {
    document.documentElement.dataset.layout = value;
    window.dispatchEvent(new Event('dayline:appearance'));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[value]);
  }
  apply(current);
  document.addEventListener('DOMContentLoaded', () => {
    const choices = document.querySelectorAll('input[name="layout"]'),
      status = document.querySelector('#layout-status');
    function select(value) {
      current = value;
      apply(value);
      choices.forEach((input) => {
        input.checked = input.value === value;
      });
    }
    select(current);
    choices.forEach((input) =>
      input.addEventListener('change', () => {
        if (!input.checked || !layouts.includes(input.value)) return;
        select(input.value);
        try {
          localStorage.setItem(key, current);
          status.textContent = 'Layout saved on this device.';
        } catch {
          status.textContent =
            'Layout applied for now. Your browser could not save this preference.';
        }
        window.dispatchEvent(new Event('dayline:layout-saved'));
      }),
    );
    window.addEventListener('dayline:preview-layout', (event) => {
      if (layouts.includes(event.detail)) select(event.detail);
    });
    window.addEventListener('dayline:set-layout', (event) => {
      if (!layouts.includes(event.detail)) return;
      select(event.detail);
      try {
        localStorage.setItem(key, current);
        status.textContent = 'Layout saved on this device.';
      } catch {
        status.textContent = 'Layout applied for this visit. Your browser could not save it.';
      }
      window.dispatchEvent(new Event('dayline:layout-saved'));
    });
    window.addEventListener('dayline:apply-account-layout', (event) => {
      if (!layouts.includes(event.detail)) return;
      select(event.detail);
      try {
        localStorage.setItem(key, current);
        status.textContent = 'Personality synced with your account.';
      } catch {
        status.textContent = 'Account personality applied for this visit.';
      }
    });
    window.addEventListener('storage', (event) => {
      if (event.key === key) select(layouts.includes(event.newValue) ? event.newValue : 'zen');
    });
  });
})();
