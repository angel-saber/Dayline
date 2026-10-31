import { load, validState } from '../../shared/storage.js?v=a5e287120672';

const SNAPSHOT = 'dayline.device-before-signin.v1';
export const countDeviceNotes = (state) =>
  Object.values(state.days).reduce((count, notes) => count + notes.length, 0);

// Keep a separate local checkpoint before switching to account notes.
// It is never uploaded automatically or overwritten with an empty guest copy.
export function preserveDeviceNotes(storage = localStorage) {
  const state = load(storage);
  if (countDeviceNotes(state)) storage.setItem(SNAPSHOT, storage.getItem('dayline.v1'));
}
export function deviceNotes(storage = localStorage) {
  const current = load(storage);
  if (countDeviceNotes(current)) return current;
  const raw = storage.getItem(SNAPSHOT);
  return raw ? validState(JSON.parse(raw)) : current;
}
