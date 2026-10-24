// These are Dayline IDs. A future auth provider must map its subject to the
// existing ID, not replace ownership IDs in notes, grants, or encrypted AAD.
export function validateAccountId(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  )
    throw new Error('Invalid Dayline account identity.');
  return value;
}
