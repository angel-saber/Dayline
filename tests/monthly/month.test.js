import test from 'node:test';
import assert from 'node:assert/strict';
import {monthWeeks,offsetMonth,noteTitle,moveToDay} from '../../dist/js/features/monthly/model.js';
import {validState,save,load} from '../../dist/js/shared/storage.js';
import {dueEntries} from '../../dist/js/shared/schedule.js';

test('month weeks cover every day once, include leap day and align Sunday through Saturday',()=>{
  for(const month of ['2024-02','2026-02','2026-10','2026-12','2027-01']){
    const weeks=monthWeeks(month),days=weeks.flat();
    assert.ok(weeks.every(w=>w.length===7));assert.equal(new Set(days).size,days.length);
    assert.ok(weeks.every(w=>new Date(w[0]+'T12:00:00Z').getUTCDay()===0));
    const expected=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
    assert.equal(days.filter(d=>d.startsWith(month)).length,expected);
  }
  assert.equal(monthWeeks('2024-02').flat().includes('2024-02-29'),true);
  assert.equal(offsetMonth('2026-12',1),'2027-01');assert.equal(offsetMonth('2027-01',-1),'2026-12');
});
test('note labels prefer titles, fall back to first nonempty line, and handle title-only notes',()=>{
  assert.equal(noteTitle({title:'  Film prep ',text:'other'}),'Film prep');
  assert.equal(noteTitle({text:'\nFirst line\nSecond line'}),'First line');
  assert.equal(noteTitle({title:' ',text:''}),'Untitled note');
});
test('cross-day moves preserve all note content and both notes when times collide',()=>{
  const moved={id:'one',title:'Film prep',text:'Task',minute:120,done:false,format:[{start:0,end:4,bold:true}],tasks:[{start:0,done:true}],task:false};
  const other={id:'two',text:'Existing',minute:120,done:true};
  const days={'2026-10-31':[moved],'2026-11-01':[other]};const original=structuredClone(days);
  const next=moveToDay(days,'2026-10-31','one','2026-11-01');
  assert.deepEqual(days,original);assert.deepEqual(next['2026-10-31'],[]);assert.equal(next['2026-11-01'].length,2);
  assert.deepEqual(next['2026-11-01'].find(e=>e.id==='one'),moved);
  assert.deepEqual(moveToDay(next,'2026-11-01','one','2026-10-31'),days);
});
test('moves reject invalid dates and ID collisions without changing existing notes',()=>{
  const entry={id:'one',text:'x',minute:0,done:false};const days={'2026-10-22':[entry],'2026-10-23':[entry]};
  assert.throws(()=>moveToDay(days,'2026-10-22','one','2026-02-30'));
  assert.throws(()=>moveToDay(days,'2026-10-22','one','2026-10-23'));
  assert.equal(moveToDay(days,'2026-10-22','missing','2026-10-23'),days);
  assert.equal(moveToDay(days,'2026-10-22','one','2026-10-22'),days);
});
test('optional titles and title-only notes survive backups and reloads',()=>{
  const entry={id:'one',title:'Just a title',text:'',minute:60,done:false};
  const state={version:1,days:{'2026-10-22':[entry]}};let raw;const storage={setItem(k,v){raw=v;},getItem(){return raw;}};
  save(state,storage);assert.deepEqual(load(storage).days['2026-10-22'][0],entry);
  assert.throws(()=>validState({...state,days:{'2026-10-22':[{...entry,title:12}]}}));
  assert.throws(()=>validState({...state,days:{'2026-10-22':[{...entry,title:'x'.repeat(201)}]}}));
  assert.equal(validState({...state,days:{'2026-10-22':[{id:'old',text:'old',minute:0,done:false}]}}).days['2026-10-22'][0].title,undefined);
});
test('title-only planned notes remain eligible for reminders',()=>{
  const now=new Date(2026,9,22,1).getTime();
  assert.equal(dueEntries([{id:'one',title:'Plan',text:'',minute:60,done:false}],'2026-10-22',60,now-1000,now).length,1);
});
