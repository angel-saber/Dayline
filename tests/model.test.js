import test from 'node:test';
import assert from 'node:assert/strict';
import {slots,grouped,moveEntry,offsetDay,timeLabel,dueEntries} from '../dist/js/model.js';
import {validState,load,save} from '../dist/js/storage.js';
const note=(id,minute,text=id,done=false)=>({id,minute,text,done});
test('all presets and uneven custom intervals cover the full day',()=>{
  for(const interval of [15,30,60,120,240,47,1440,1]){const starts=slots(interval);assert.equal(starts[0],0);assert.ok(starts.at(-1)<1440);assert.ok(starts.at(-1)+interval>=1440);}
  for(const bad of [0,-1,1441,1.5,NaN])assert.throws(()=>slots(bad));
});
test('moving later shifts affected occupied and empty slots toward the source',()=>{
  const original=[note('a',480),note('b',540),note('c',660),note('d',720)];
  const moved=moveEntry(original,'a',660,60);
  assert.deepEqual(Object.fromEntries(moved.map(e=>[e.id,e.minute])),{b:480,c:600,a:660,d:720});
  assert.equal(original[0].minute,480);
});
test('moving earlier inserts without overwriting destination',()=>{
  const moved=moveEntry([note('a',480),note('b',540),note('c',600)],'c',480,60);
  assert.deepEqual(moved.map(e=>[e.id,e.minute]),[['c',480],['a',540],['b',600]]);
});
test('interval regrouping and dragging preserve every note and completion state',()=>{
  const original=[note('a',480),note('b',495,'hello',true),note('c',540),note('d',555)];
  assert.equal(grouped(original,120).flatMap(s=>s.entries).length,4);
  const moved=moveEntry(original,'c',480,60);
  assert.equal(moved.length,original.length);assert.equal(new Set(moved.map(e=>e.id)).size,4);
  assert.equal(moved.find(e=>e.id==='b').done,true);
});
test('moving from a shared bucket retains other source notes',()=>{
  const moved=moveEntry([note('a',480),note('b',495),note('c',540)],'a',540,60);
  assert.deepEqual(moved.map(e=>e.id).sort(),['a','b','c']);
  assert.equal(moved.find(e=>e.id==='a').minute,540);
  assert.equal(moved.find(e=>e.id==='b').minute,495);
  assert.equal(moved.find(e=>e.id==='c').minute,480);
});
test('all pairwise reorders retain notes and yield valid times',()=>{
  for(const interval of [15,47,60,120,240]){
    const all=slots(interval),entries=all.map((m,i)=>note(String(i),m));
    for(const source of [0,Math.floor(all.length/2),all.length-1])for(const target of all){
      const result=moveEntry(entries,String(source),target,interval);
      assert.equal(result.length,entries.length);assert.equal(new Set(result.map(e=>e.minute)).size,entries.length);
      assert.equal(result.find(e=>e.id===String(source)).minute,target);
      assert.ok(result.every(e=>e.minute>=0&&e.minute<1440));
    }
  }
});
test('date navigation crosses year and leap boundaries',()=>{assert.equal(offsetDay('2026-12-31',1),'2027-01-01');assert.equal(offsetDay('2024-03-01',-1),'2024-02-29');assert.equal(offsetDay('2026-03-08',1),'2026-03-09');});
test('labels support midnight and both clock formats',()=>{assert.equal(timeLabel(0),'12:00 AM');assert.equal(timeLabel(720),'12:00 PM');assert.equal(timeLabel(1439,'24'),'23:59');assert.equal(timeLabel(1440,'24'),'24:00');});
test('only due unfinished nonempty notes notify',()=>{
  const time=new Date(2026,9,19,9,0,0).getTime();
  const list=[note('yes',540),note('done',540,'done',true),note('blank',540,' '),note('later',600)];
  assert.deepEqual(dueEntries(list,'2026-10-19',60,time-1000,time).map(e=>e.id),['yes']);
  assert.deepEqual(dueEntries(list,'2026-10-19',60,time,time+1000),[]);
});
test('saving and restoring preserve multiline and literal HTML text',()=>{
  let raw;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};
  const state={version:1,days:{'2026-10-19':[note('x',123,'<script>\n☀️')]},settings:{interval:47}};
  save(state,storage);const restored=load(storage);assert.equal(restored.days['2026-10-19'][0].text,'<script>\n☀️');assert.equal(restored.settings.interval,47);
});
test('malformed backups fail safely',()=>{
  assert.throws(()=>validState({}));
  assert.throws(()=>validState({version:1,days:{'2026-10-19':[note('a',1440)]}}));
  assert.throws(()=>validState({version:1,days:{'2026-10-19':[note('a',1),note('a',2)]}}));
  assert.throws(()=>validState({version:1,days:{},settings:{interval:0}}));
});
