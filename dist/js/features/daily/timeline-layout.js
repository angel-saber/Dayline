// Time labels carry exact scheduling; empty time gets a small, bounded visual gap.
export function intervalLayout(items, start, interval, minimum = 120) {
  const duration = Math.min(interval, 1440 - start);
  let cursor = 0,
    previousMinute = start;
  const placed = [];
  for (const item of [...items].sort((a, b) => a.minute - b.minute)) {
    const minute = Math.max(start, Math.min(start + duration - 1, item.minute));
    const gap = ((minute - previousMinute) / duration) * 12;
    cursor += (placed.length ? 8 : 0) + gap;
    placed.push({ ...item, top: cursor });
    cursor += item.height;
    previousMinute = minute;
  }
  return { height: Math.max(minimum, cursor + 8), items: placed };
}

export function bindIntervalLayout(timeline, interval) {
  const slots = [...timeline.querySelectorAll('.slot:not(.all-day-slot)')];
  let stopped = false;
  function update() {
    if (stopped) return;
    for (const slot of slots) {
      const notes = slot.querySelector('.slot-notes');
      // Keep the editor in normal flow; typing must never move its caret or change focus.
      const editing = !!notes.querySelector('.editor');
      const cards = [...notes.querySelectorAll(':scope > .entry')];
      slot.classList.toggle('precise-layout', !editing && cards.length > 0);
      if (editing || !cards.length) {
        slot.style.removeProperty('--interval-height');
        for (const card of cards) card.style.removeProperty('top');
        continue;
      }
      const layout = intervalLayout(
        cards.map((card) => ({
          card,
          minute: Number(card.dataset.minute),
          height: card.getBoundingClientRect().height || 58,
        })),
        Number(slot.dataset.minute),
        interval,
      );
      slot.style.setProperty('--interval-height', `${layout.height}px`);
      for (const { card, top } of layout.items) card.style.top = `${top}px`;
    }
  }
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  function observe() {
    resize?.disconnect();
    for (const slot of slots)
      for (const card of slot.querySelectorAll('.entry')) resize?.observe(card);
    update();
  }
  const changes = typeof MutationObserver === 'function' ? new MutationObserver(observe) : null;
  for (const slot of slots)
    changes?.observe(slot.querySelector('.slot-notes'), { childList: true });
  window.addEventListener('resize', update);
  observe();
  return () => {
    stopped = true;
    resize?.disconnect();
    changes?.disconnect();
    window.removeEventListener('resize', update);
  };
}
