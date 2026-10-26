import { dropHover } from './drop-hover.js?v=3bc29ba06496';
// One delegated pointer controller; never blocks vertical scrolling on note cards.
export function attachGestures(root, { complete, remove, move, announce }) {
  let active = null,
    suppressClick = false;
  const hover = dropHover({
    onChange(id, armed) {
      root
        .querySelectorAll('.replace-pending,.replace-ready')
        .forEach((el) => el.classList.remove('replace-pending', 'replace-ready'));
      if (!id) return;
      root
        .querySelector(`[data-id="${CSS.escape(id)}"]`)
        ?.classList.add(armed ? 'replace-ready' : 'replace-pending');
      if (armed) announce('Release to swap these two notes. Move away to add without swapping.');
    },
  });
  function inspectTarget(x, y) {
    const hit = document.elementFromPoint(x, y),
      slot = hit?.closest('.slot');
    root.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const valid = slot && root.contains(slot);
    if (valid) slot.classList.add('drop-target');
    active.target = valid ? slot.dataset.minute : undefined;
    const note = valid ? hit?.closest('.entry') : null;
    hover.update(note && note.dataset.id !== active.id ? note.dataset.id : null);
  }
  root.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    },
    true,
  );
  const clear = () => {
    if (!active) return;
    clearTimeout(active.hold);
    cancelAnimationFrame(active.frame);
    hover.clear();
    active.card?.classList.remove('dragging', 'swiping');
    active.card?.style.removeProperty('--swipe');
    document.querySelectorAll('.drop-target').forEach((e) => e.classList.remove('drop-target'));
    active = null;
  };
  root.addEventListener('pointerdown', (e) => {
    if (
      root.dataset.selecting === 'true' ||
      e.button !== 0 ||
      e.target.closest('textarea,select,input,a,details') ||
      (e.target.closest('button') && !e.target.closest('.note-text'))
    )
      return;
    const card = e.target.closest('.entry');
    if (!card) return;
    active = {
      id: card.dataset.id,
      card,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      pointer: e.pointerId,
      drag: false,
      handle: !!e.target.closest('.drag-handle'),
    };
    if (active.handle) {
      active.hold = setTimeout(() => {
        if (!active) return;
        active.drag = true;
        card.classList.add('dragging');
        card.setPointerCapture(e.pointerId);
        announce('Drop in an interval to add your note. Hold over a note to swap positions.');
        function scroll() {
          if (!active?.drag) return;
          inspectTarget(active.lastX, active.lastY);
          const y = active.lastY;
          if (y < 110) window.scrollBy(0, -12);
          else if (y > innerHeight - 110) window.scrollBy(0, 12);
          active.frame = requestAnimationFrame(scroll);
        }
        scroll();
      }, 350);
    }
  });
  root.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.pointer) return;
    const dx = e.clientX - active.x,
      dy = e.clientY - active.y;
    active.lastX = e.clientX;
    active.lastY = e.clientY;
    if (active.drag) {
      e.preventDefault();
      inspectTarget(e.clientX, e.clientY);
      return;
    }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(active.hold);
    if (!active.handle && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12) {
      active.card.classList.add('swiping');
      active.card.style.setProperty('--swipe', `${Math.max(-110, Math.min(110, dx))}px`);
    }
  });
  root.addEventListener('pointerup', (e) => {
    if (!active || active.pointer !== e.pointerId) return;
    if (active.drag) inspectTarget(e.clientX, e.clientY);
    const targetId = hover.targetId;
    const { id, drag, target, handle, x, y } = active,
      dx = e.clientX - x,
      dy = e.clientY - y;
    clear();
    if (drag && target !== undefined) {
      suppressClick = true;
      move(id, Number(target), targetId);
    } else if (!handle && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick = true;
      if (dx > 0) complete(id);
      else remove(id);
    }
    if (suppressClick)
      setTimeout(() => {
        suppressClick = false;
      }, 0);
  });
  root.addEventListener('pointercancel', clear);
  window.addEventListener('blur', clear);
  return clear;
}
