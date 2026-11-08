export function bindListGestures(list, { complete, remove, reorder }) {
  let active = null,
    suppress = false,
    frame;
  function clear() {
    cancelAnimationFrame(frame);
    active?.row.classList.remove('list-dragging');
    list
      .querySelectorAll('.list-before,.list-after')
      .forEach((row) => row.classList.remove('list-before', 'list-after'));
    active = null;
  }
  function targetAt(x, y) {
    const row = document.elementFromPoint(x, y)?.closest('[data-card-key]');
    return row && list.contains(row) && row !== active?.row ? row : null;
  }
  list.addEventListener(
    'click',
    (event) => {
      if (suppress) {
        event.preventDefault();
        event.stopPropagation();
        suppress = false;
      }
    },
    true,
  );
  list.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.list-reorder'),
      row = event.target.closest('[data-card-key]');
    if (
      event.button !== 0 ||
      !row ||
      (!handle &&
        event.target.closest('button,input,a,summary,textarea,select') &&
        !event.target.closest('.list-note-title'))
    )
      return;
    active = {
      row,
      key: row.dataset.cardKey,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastY: event.clientY,
      drag: !!handle,
      target: null,
      after: false,
    };
    if (handle) {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture?.(event.pointerId);
      row.classList.add('list-dragging');
      function scroll() {
        if (!active?.drag || !list.isConnected) {
          clear();
          return;
        }
        if (active.lastY < 100) window.scrollBy(0, -12);
        else if (active.lastY > window.innerHeight - 100) window.scrollBy(0, 12);
        frame = requestAnimationFrame(scroll);
      }
      scroll();
    }
  });
  list.addEventListener('pointermove', (event) => {
    if (!active || active.id !== event.pointerId) return;
    active.lastY = event.clientY;
    if (!active.drag) return;
    event.preventDefault();
    const row = targetAt(event.clientX, event.clientY);
    list
      .querySelectorAll('.list-before,.list-after')
      .forEach((el) => el.classList.remove('list-before', 'list-after'));
    active.target = row?.dataset.cardKey;
    const rect = row?.getBoundingClientRect();
    active.after = rect ? event.clientY > rect.top + rect.height / 2 : false;
    row?.classList.add(active.after ? 'list-after' : 'list-before');
  });
  list.addEventListener('pointerup', (event) => {
    if (!active || active.id !== event.pointerId) return;
    const a = active;
    const row = a.drag ? targetAt(event.clientX, event.clientY) : null;
    const rect = row?.getBoundingClientRect();
    const target = row?.dataset.cardKey,
      after = rect ? event.clientY > rect.top + rect.height / 2 : false;
    clear();
    if (!list.isConnected) return;
    if (a.drag) {
      suppress = true;
      if (target) reorder(a.key, target, after);
    } else {
      const dx = event.clientX - a.x,
        dy = event.clientY - a.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppress = true;
        dx > 0 ? complete(a.key) : remove(a.key);
      }
    }
    if (suppress) setTimeout(() => (suppress = false), 0);
  });
  list.addEventListener('pointercancel', clear);
  list.addEventListener('lostpointercapture', clear);
  list.addEventListener('keydown', (event) => {
    const handle = event.target.closest('.list-reorder');
    if (!handle || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rows = [...list.querySelectorAll('[data-card-key]')],
      index = rows.indexOf(handle.closest('[data-card-key]')),
      other = rows[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (other)
      reorder(rows[index].dataset.cardKey, other.dataset.cardKey, event.key === 'ArrowDown');
  });
  return clear;
}
