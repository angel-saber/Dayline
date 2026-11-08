import { dropTimePreview } from '../daily/drop-time.js?v=c43c8d2c5a01';
// Pointer capture keeps touch and mouse dragging alive after the drawer closes.
export function commitmentTimelineDrag(
  handle,
  { begin, drop, cancel = () => {}, root, interval, clock = () => '24h' },
) {
  const preview = dropTimePreview(root);
  let lockedMinute = null;
  let active = false,
    frame = null,
    position = null,
    target = null,
    origin = null;
  function inspect() {
    handle.style.left = position.x + 12 + 'px';
    handle.style.top = position.y + 12 + 'px';
    root.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const slot = document.elementFromPoint(position.x, position.y)?.closest('.slot');
    target = slot && root.contains(slot) ? slot : null;
    if (target?.dataset.minute === '-1') target = null;
    target?.classList.add('drop-target');
    lockedMinute = preview.show(target, position.y, interval(), clock());
  }
  function clear() {
    active = false;
    preview.clear();
    cancelAnimationFrame(frame);
    root.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    handle.classList.remove('commitment-drag-ghost');
    handle.style.removeProperty('left');
    handle.style.removeProperty('top');
    if (origin)
      origin.parent.insertBefore(
        handle,
        origin.next?.parentNode === origin.parent ? origin.next : null,
      );
    origin = null;
  }
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || active) return;
    event.preventDefault();
    origin = { parent: handle.parentNode, next: handle.nextSibling };
    document.body.append(handle);
    handle.classList.add('commitment-drag-ghost');
    if (begin() === false) {
      clear();
      return;
    }
    active = true;
    position = { x: event.clientX, y: event.clientY, id: event.pointerId };
    handle.setPointerCapture?.(event.pointerId);

    function scroll() {
      if (!active) return;
      inspect();
      if (position.y < 100) window.scrollBy(0, -12);
      else if (position.y > window.innerHeight - 100) window.scrollBy(0, 12);
      frame = requestAnimationFrame(scroll);
    }
    scroll();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!active || position.id !== event.pointerId) return;
    event.preventDefault();
    position.x = event.clientX;
    position.y = event.clientY;
    inspect();
  });
  handle.addEventListener('pointerup', (event) => {
    if (!active || position.id !== event.pointerId) return;
    position.x = event.clientX;
    position.y = event.clientY;
    inspect();
    const minute = target ? lockedMinute : null;
    clear();
    if (minute !== null) drop(minute);
    else cancel();
  });
  handle.addEventListener('pointercancel', () => {
    if (active) {
      clear();
      cancel();
    }
  });
  handle.addEventListener('lostpointercapture', () => {
    if (active) {
      clear();
      cancel();
    }
  });
  handle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  return clear;
}
