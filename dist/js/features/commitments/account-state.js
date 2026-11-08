import { validCommitmentState } from './game.js?v=4c38d9100be9';
export const COMMITMENT_DATE = '1900-01-01';
export function commitmentRecords(days, all = false) {
  return (days[COMMITMENT_DATE] || [])
    .filter((n) => n.yearly?.kind === 'commitments' && (all || n.yearly.status !== 'released'))
    .slice()
    .sort(
      (a, b) => (b.yearly.updatedAt || 0) - (a.yearly.updatedAt || 0) || a.id.localeCompare(b.id),
    );
}
export function commitmentToken(days) {
  return JSON.stringify(
    commitmentRecords(days).map((n) => ({ id: n.id, text: n.text, updatedAt: n.yearly.updatedAt })),
  );
}
export function writeCommitmentAccount(
  days,
  value,
  expected,
  resolveId = null,
  newId = () => crypto.randomUUID(),
) {
  if (commitmentToken(days) !== expected)
    throw Error('Commitments changed on another device. Reopen the list before saving.');
  const records = commitmentRecords(days);
  if (records.length > 1 && !resolveId)
    throw Error('Two saved commitment lists were retained. Choose a version below before editing.');
  const chosen = resolveId ? records.find((n) => n.id === resolveId) : records[0];
  if (resolveId && !chosen) throw Error('That saved version changed. Reopen the list.');
  const text = JSON.stringify(validCommitmentState({ ...value, lastPing: '' }));
  if (text.length > 200000)
    throw Error('Commitment history is too large to sync. Your device copy has been kept.');
  const updatedAt = Math.max(
    Date.now(),
    ...commitmentRecords(days, true).map((n) => (n.yearly.updatedAt || 0) + 1),
  );
  const record = {
    id: chosen?.id || newId(),
    text,
    title: 'Daily Commitments',
    minute: 0,
    done: false,
    yearly: {
      year: 1900,
      quarter: 0,
      kind: 'commitments',
      status: 'active',
      dimension: '',
      nextStep: '',
      reflection: '',
      updatedAt,
      history: [],
    },
  };
  const entries = (days[COMMITMENT_DATE] || []).map((n) =>
    n.id === record.id
      ? record
      : resolveId && records.some((v) => v.id === n.id)
        ? { ...n, yearly: { ...n.yearly, status: 'released' } }
        : n,
  );
  if (!chosen) entries.push(record);
  if (new TextEncoder().encode(JSON.stringify(entries)).length > 900000)
    throw Error('This account data page is full. Export a backup before adding history.');
  return { ...days, [COMMITMENT_DATE]: entries };
}
export function importDeviceCommitments(account, device) {
  if (!account.items.length)
    return validCommitmentState(structuredClone({ ...device, lastPing: '' }));
  const next = structuredClone(account);
  for (const item of device.items) {
    const existing = next.items.find((v) => v.id === item.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(item)) continue;
    const copy = structuredClone(item);
    if (existing) {
      let hash = 2166136261;
      for (const char of JSON.stringify(item))
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      copy.id = `device-${(hash >>> 0).toString(16)}-${item.id}`.slice(0, 100);
      if (next.items.some((v) => v.id === copy.id)) continue;
      copy.title = (copy.title + ' (device copy)').slice(0, 100);
    }
    next.items.push(copy);
  }
  if (next.game.enabled) next.game.cap = Math.max(next.game.cap, next.items.length);
  return validCommitmentState(next);
}
