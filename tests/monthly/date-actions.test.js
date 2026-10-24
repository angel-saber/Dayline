import test from 'node:test';
import assert from 'node:assert/strict';
import {dateActions} from '../../dist/js/features/monthly/date-actions.js';
import {quickNote} from '../../dist/js/features/monthly/model.js';
import {validState} from '../../dist/js/shared/storage.js';
function setup(){
  const calls=[],timers=new Map();let id=0,active=true;
  const actions=dateActions({onAdd:date=>calls.push(['add',date]),onOpen:date=>calls.push(['open',date]),isActive:()=>active,schedule:fn=>{timers.set(++id,fn);return id;},cancel:id=>timers.delete(id)});
  return {actions,calls,hide(){active=false;},flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}};
}
test('one click opens quick add after the double-click window',()=>{const s=setup();s.actions.click('2026-10-23');assert.deepEqual(s.calls,[]);s.flush();assert.deepEqual(s.calls,[['add','2026-10-23']]);});
test('desktop double click opens Daily without opening quick add',()=>{const s=setup();s.actions.click('2026-10-23',1);s.actions.click('2026-10-23',2);s.flush();assert.deepEqual(s.calls,[['open','2026-10-23']]);});
test('two touch taps with single-click details also open Daily',()=>{const s=setup();s.actions.click('2026-10-23',1);s.actions.click('2026-10-23',1);s.flush();assert.deepEqual(s.calls,[['open','2026-10-23']]);});
test('keyboard activation opens quick add immediately',()=>{const s=setup();s.actions.click('2026-10-23',0);assert.deepEqual(s.calls,[['add','2026-10-23']]);});
test('month navigation or leaving Monthly cancels delayed quick add',()=>{const s=setup();s.actions.click('2026-10-23');s.actions.reset();s.flush();assert.deepEqual(s.calls,[]);s.actions.click('2026-10-23');s.hide();s.flush();assert.deepEqual(s.calls,[]);});
test('clicks on different dates never count as a double tap',()=>{const s=setup();s.actions.click('2026-10-23');s.actions.click('2026-10-24');s.flush();assert.deepEqual(s.calls,[['add','2026-10-24']]);});
test('quick add creates a valid title-only note at an exact time',()=>{
  const note=quickNote('  Writing session  ','14:35','quick-one');assert.equal(note.title,'Writing session');assert.equal(note.minute,875);assert.equal(note.text,'');
  assert.deepEqual(validState({version:1,days:{'2026-10-23':[note]}}).days['2026-10-23'][0],note);
  assert.equal(quickNote('Midnight','00:00','two').minute,0);assert.equal(quickNote('Late','23:59','three').minute,1439);
});
test('quick add rejects blank or oversized titles and invalid times',()=>{
  for(const title of ['   ','x'.repeat(201)])assert.throws(()=>quickNote(title,'09:00','one'));
  for(const time of ['24:00','12:60','9:00','bad'])assert.throws(()=>quickNote('Title',time,'one'));
});
