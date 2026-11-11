export function reorderCommitments(items, id, targetId, after = false) {
  const source = items.find((item) => item.id === id);
  if (!source || id === targetId || !items.some((item) => item.id === targetId)) return items;
  const next = items.filter((item) => item.id !== id);
  next.splice(next.findIndex((item) => item.id === targetId) + Number(after), 0, source);
  return next;
}
export function bindCommitmentReorder(handle, { list, id, move, begin = () => {} }) {
  let pointer = null,
    target = null,
    after = false;
  function clear() {
    pointer = null;
    target = null;
    list
      .querySelectorAll('.commitment-reorder-before,.commitment-reorder-after')
      .forEach((row) =>
        row.classList.remove('commitment-reorder-before', 'commitment-reorder-after'),
      );
  }
  function inspect(event) {
    list
      .querySelectorAll('.commitment-reorder-before,.commitment-reorder-after')
      .forEach((row) =>
        row.classList.remove('commitment-reorder-before', 'commitment-reorder-after'),
      );
    const bounds = list.getBoundingClientRect();
    target = null;
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top - 12 ||
      event.clientY > bounds.bottom + 12
    )
      return;
    // Use row geometry so the gaps between cards are valid drop targets too.
    const rows = [...list.querySelectorAll('[data-commitment-id]')];
    target =
      rows.find((row) => {
        const rect = row.getBoundingClientRect();
        return event.clientY <= rect.top + rect.height / 2;
      }) || rows.at(-1);
    after =
      !!target &&
      event.clientY >
        target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    if (target?.dataset.commitmentId === id) target = null;
    target?.classList.add(after ? 'commitment-reorder-after' : 'commitment-reorder-before');
  }
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    begin();
    pointer = event.pointerId;
    handle.setPointerCapture?.(pointer);
  });
  handle.addEventListener('pointermove', (event) => {
    if (pointer !== event.pointerId) return;
    event.preventDefault();
    inspect(event);
    const dialog = list.closest('dialog'),
      rect = dialog?.getBoundingClientRect();
    if (rect && event.clientY < rect.top + 70) dialog.scrollTop -= 12;
    else if (rect && event.clientY > rect.bottom - 70) dialog.scrollTop += 12;
  });
  handle.addEventListener('pointerup', (event) => {
    if (pointer !== event.pointerId) return;
    inspect(event);
    const targetId = target?.dataset.commitmentId,
      insertAfter = after;
    clear();
    if (targetId) move(id, targetId, insertAfter);
  });
  handle.addEventListener('pointercancel', clear);
  handle.addEventListener('lostpointercapture', clear);
  handle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  function step(direction) {
    const rows = [...list.querySelectorAll('[data-commitment-id]')],
      index = rows.findIndex((row) => row.dataset.commitmentId === id);
    const other = rows[index + direction];
    if (other) {
      begin();
      move(id, other.dataset.commitmentId, direction > 0);
    }
  }
  handle.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    step(event.key === 'ArrowUp' ? -1 : 1);
  });
  return step;
}
