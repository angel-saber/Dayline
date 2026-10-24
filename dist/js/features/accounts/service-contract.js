// Interfaces used by the planner. HTTP paths, SDKs and credential formats stay
// in providers/. A replacement maps its subject IDs to stable Dayline user IDs.
export const AUTH_METHODS = Object.freeze([
  'readSession',
  'sendCode',
  'sendLink',
  'exchangeLink',
  'verifyCode',
  'signInPassword',
  'signOut',
]);
export const NOTES_METHODS = Object.freeze(['loadDays', 'saveDay']);
export const PREFERENCES_METHODS = Object.freeze(['loadPreferences', 'savePreferences']);

export function bindMethods(client, names) {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof client[name] !== 'function')
        throw new Error(`Account provider is missing ${name}.`);
      return [name, client[name].bind(client)];
    }),
  );
}
export function publicSession(value) {
  if (value === null) return null;
  if (!value?.user || typeof value.user.id !== 'string' || !value.user.id)
    throw new Error('Account provider returned an invalid identity.');
  return {
    user: {
      id: value.user.id,
      ...(typeof value.user.email === 'string' ? { email: value.user.email } : {}),
    },
  };
}
export function validateAccountServices(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid account service provider.');
  for (const [name, methods] of [
    ['auth', AUTH_METHODS],
    ['notes', NOTES_METHODS],
    ['preferences', PREFERENCES_METHODS],
  ]) {
    if (!value[name] || methods.some((method) => typeof value[name][method] !== 'function'))
      throw new Error(`Account provider has an incomplete ${name} interface.`);
  }
  if (
    typeof value.auth.enabled !== 'boolean' ||
    typeof value.auth.sessionKey !== 'string' ||
    !value.auth.sessionKey
  )
    throw new Error('Account provider has an invalid session interface.');
  return value;
}
