export const DEFAULT_SETTINGS = { interval: 60, notifications: false, sound: false, clock: '12' };
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function parseDay(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d,12); }
export function offsetDay(key, delta) { const d=parseDay(key); d.setDate(d.getDate()+delta); return dayKey(d); }
export function slots(interval) {
  if (!Number.isInteger(interval) || interval < 1 || interval > 1440) throw new Error('Choose 1–1440 whole minutes.');
  return Array.from({length:Math.ceil(1440/interval)},(_,i)=>i*interval);
}
export function bucket(minute, interval) { return Math.floor(minute/interval)*interval; }
export function timeLabel(minute, clock='12') {
  if (minute===1440) return clock==='24'?'24:00':'12:00 AM';
  const h=Math.floor(minute/60), m=String(minute%60).padStart(2,'0');
  return clock==='24'?`${String(h).padStart(2,'0')}:${m}`:`${h%12||12}:${m} ${h<12?'AM':'PM'}`;
}
export function grouped(entries, interval) {
  return slots(interval).map(minute=>({minute,entries:entries.filter(e=>bucket(e.minute,interval)===minute)}));
}
// Stable insertion: occupied slots shift toward the space left by the source.
// Notes sharing a bucket after an interval change always travel together when shifted.
export function moveEntry(entries, id, targetMinute, interval) {
  const moved=entries.find(e=>e.id===id);
  const starts=slots(interval);
  if (!moved || !starts.includes(targetMinute)) return entries;
  const source=bucket(moved.minute,interval);
  if (source===targetMinute) return entries;
  return entries.map(e=>{
    if(e.id===id) return {...e,minute:Math.min(1439,targetMinute+e.minute-source)};
    const b=bucket(e.minute,interval);
    if(source<targetMinute && b>source && b<=targetMinute) return {...e,minute:e.minute-interval};
    if(source>targetMinute && b>=targetMinute && b<source) return {...e,minute:Math.min(1439,e.minute+interval)};
    return e;
  }).sort((a,b)=>a.minute-b.minute);
}
// A normal drop joins a slot. A deliberately held target swaps just those notes.
export function dropEntry(entries,id,targetMinute,interval,targetId=null){
  const moved=entries.find(e=>e.id===id);if(!moved||!slots(interval).includes(targetMinute))return entries;
  const target=targetId&&targetId!==id?entries.find(e=>e.id===targetId&&bucket(e.minute,interval)===targetMinute):null;
  if(target)return entries.map(e=>e.id===id?{...e,minute:target.minute}:e.id===target.id?{...e,minute:moved.minute}:e).sort((a,b)=>a.minute-b.minute);
  const source=bucket(moved.minute,interval);if(source===targetMinute)return entries;
  const minute=Math.min(1439,targetMinute+moved.minute-source);
  return entries.map(e=>e.id===id?{...e,minute}:e).sort((a,b)=>a.minute-b.minute);
}
export function dueEntries(entries, key, interval, from, now) {
  return entries.filter(e=>{
    if(e.weekly || e.done || !(e.title?.trim()||e.text).trim()) return false;
    const date=parseDay(key); date.setHours(0,0,0,0); date.setMinutes(e.minute);
    return date.getTime()>from && date.getTime()<=now;
  });
}
