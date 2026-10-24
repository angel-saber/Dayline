export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function offsetDay(key, delta) {
  const d = parseDay(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}
export function timeLabel(minute, clock = '12') {
  if (minute === 1440) return clock === '24' ? '24:00' : '12:00 AM';
  const h = Math.floor(minute / 60),
    m = String(minute % 60).padStart(2, '0');
  return clock === '24'
    ? `${String(h).padStart(2, '0')}:${m}`
    : `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}
