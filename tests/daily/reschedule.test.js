import test from 'node:test';
import assert from 'node:assert/strict';
import {rescheduleNote} from '../../dist/js/features/daily/reschedule.js';

test('rescheduling across days preserves the whole note and leaves other notes in place',()=>{
  const note={id:'a',minute:615,title:'Project',text:'Plan',done:false,tags:['Project','Event'],attachments:[{id:'file'}],focusReports:[{id:'report'}]};
  const days={'2026-10-23':[note,{id:'b',minute:660}], '2026-10-24':[{id:'c',minute:735}]};
  const next=rescheduleNote(days,'2026-10-23','a','2026-10-24','12:15');
  assert.deepEqual(next['2026-10-23'],[{id:'b',minute:660}]);
  assert.deepEqual(next['2026-10-24'],[{id:'c',minute:735},{...note,minute:735}]);
  assert.equal(days['2026-10-23'][0],note);
  assert.equal(note.minute,615);
});
test('same-day rescheduling changes only the chosen note at an exact minute',()=>{
  const weekly={id:'week',weekly:true,minute:0},other={id:'b',minute:615};
  const days={'2026-10-25':[{id:'a',minute:540},weekly,other]};
  const next=rescheduleNote(days,'2026-10-25','a','2026-10-25','10:15');
  assert.equal(next['2026-10-25'].find(n=>n.id==='a').minute,615);
  assert.equal(next['2026-10-25'].find(n=>n.id==='b'),other);
  assert.equal(next['2026-10-25'].find(n=>n.weekly),weekly);
});
test('invalid dates, times, stale identities, and duplicate destination IDs cannot move a note',()=>{
  const days={'2026-10-23':[{id:'a',minute:0}], '2026-10-24':[{id:'a',minute:60}]};
  for(const [id,date,time] of [['a','2026-02-30','10:00'],['a','2026-10-24','24:00'],['missing','2026-10-24','10:00'],['a','2026-10-24','10:00']]){
    assert.throws(()=>rescheduleNote(days,'2026-10-23',id,date,time));
  }
  assert.equal(days['2026-10-23'].length,1);
});
