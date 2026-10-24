// Defer a pointer's single click briefly so its second click can open the day
// without first opening a dialog. Touch clicks use the same timing as a mouse.
export function dateActions({
  onAdd,
  onOpen,
  isActive = () => true,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let pending = null;
  function reset() {
    if (pending) cancel(pending.timer);
    pending = null;
  }
  return {
    reset,
    click(date, detail = 1) {
      if (detail === 0) {
        reset();
        if (isActive()) onAdd(date);
        return;
      }
      if (detail > 1 || pending?.date === date) {
        reset();
        if (isActive()) onOpen(date);
        return;
      }
      reset();
      pending = {
        date,
        timer: schedule(() => {
          pending = null;
          if (isActive()) onAdd(date);
        }, 400),
      };
    },
  };
}
