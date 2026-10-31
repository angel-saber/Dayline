import { node } from '../../shared/dom.js?v=b8179ad8cdac';
export function chooseRepeatScope(action, choose) {
  const dialog = node('dialog', 'repeat-scope-dialog');
  dialog.setAttribute('aria-labelledby', 'repeat-scope-heading');
  const heading = node('h2', '', `${action} repeating note`);
  heading.id = 'repeat-scope-heading';
  const actions = node('div', 'inline');
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  for (const [text, scope] of [
    ['Only this note', 'one'],
    ['This and later repeats', 'following'],
    ['Cancel', null],
  ]) {
    const button = node('button', 'secondary', text);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!scope) {
        dialog.close();
        return;
      }
      try {
        if (choose(scope) !== false) dialog.close();
        else status.textContent = 'Could not save this change. Please try again.';
      } catch (error) {
        status.textContent = error.message;
      }
    });
    actions.append(button);
  }
  dialog.append(
    heading,
    node(
      'p',
      '',
      'Choose whether this change applies only here or to this occurrence and all later occurrences in the same finite cycle. Earlier occurrences and other cycles stay unchanged. A single note rescheduled outside its cycle becomes a standalone note.',
    ),
    actions,
    status,
  );
  const close = () => dialog.close();
  window.addEventListener('dayline:account', close);
  dialog.addEventListener(
    'close',
    () => {
      window.removeEventListener('dayline:account', close);
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
