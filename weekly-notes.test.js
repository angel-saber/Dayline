import test from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,weeklyNotes,changeWeekly} from './dist/js/weekly-model.js';
import {validState} from './dist/js/storage.js';
import {dueEntries} from './dist/js/model.js';
import {emptyIntervals} from './dist/js/availability-model.js';
import {focusIntervalNotes,findFocusNote} from './dist/js/focus-model.js';
import {matchingNotes} from './dist/js/bulk-model.js';
import {shareNoteText} from './dist/js/share-note.js';
import {attachGuidedPlan,validGuidedReports,compassTitle} from './dist/js/activities-model.js';
import {lifeDimensions} from './dist/js/activity-catalog.js';
import {exportFiles,prepareFiles} from './dist/js/attachments.js';
const sunday='2026-10-18',friday='2026-10-23';
const create=days=>changeWeekly(days,friday,null,{kind:'create'},()=> 'weekly-1');
test('weekly notes use the calendar week, create multiple independent notes, and never roll over',()=>{
 assert.equal(weekStart(friday),sunday);assert.equal(weekStart('2026-11-01'),'2026-11-01');
 const original={},first=create(original),second=changeWeekly(first.days,sunday,null,{kind:'create'},()=> 'weekly-2');
 assert.equal(weeklyNotes(second.days,friday).length,2);assert.equal(weeklyNotes(second.days,'2026-10-25').length,0);assert.deepEqual(original,{});assert.deepEqual(first.previous,{[sunday]:[]});
});
test('weekly edits and completion preserve body formatting, tags, attachments, and neighboring Daily notes',()=>{
 const daily={id:'daily',text:'Sunday plan',minute:0,done:false};let result=create({[sunday]:[daily]});
 const values={title:'Catch-all',text:'Task',tasks:[{start:0,done:true}],format:[{start:0,end:4,bold:true}],indents:[{start:0,level:2}],tags:['project','event'],attachments:[{id:'file',name:'a.txt',type:'text/plain',size:1}],minute:700};
 result=changeWeekly(result.days,sunday,'weekly-1',{kind:'update',values});const entry=weeklyNotes(result.days,sunday)[0];assert.equal(entry.minute,0);assert.equal(entry.weekly,true);assert.equal(entry.tasks[0].done,true);assert.deepEqual(result.days[sunday][0],daily);
 const completed=changeWeekly(result.days,sunday,'weekly-1',{kind:'complete'});assert.equal(weeklyNotes(completed.days,sunday)[0].done,true);assert.deepEqual(completed.days[sunday][0],daily);
 const deleted=changeWeekly(completed.days,sunday,'weekly-1',{kind:'delete'});assert.deepEqual(deleted.days[sunday],[daily]);assert.equal(deleted.previous[sunday].length,2);
});
test('scheduling is a move that retains every field and removes the weekly flag even on the same Sunday',()=>{
 let result=create({});result=changeWeekly(result.days,sunday,'weekly-1',{kind:'update',values:{title:'Keep me',text:'Task',tags:['event'],tasks:[{start:0,done:true}]}});
 const scheduled=changeWeekly(result.days,sunday,'weekly-1',{kind:'schedule',date:sunday,minute:615});assert.equal(scheduled.days[sunday].length,1);const note=scheduled.days[sunday][0];assert.equal(note.weekly,undefined);assert.equal(note.minute,615);assert.equal(note.title,'Keep me');assert.equal(note.tasks[0].done,true);assert.deepEqual(note.tags,['event']);assert.equal(weeklyNotes(scheduled.days,sunday).length,0);assert.equal(scheduled.previous[sunday][0].weekly,true);
});
test('week moves cross months without changing contents, and scheduling resolves ID collisions without overwriting',()=>{
 const first=create({}),moved=changeWeekly(first.days,sunday,'weekly-1',{kind:'move',date:'2026-11-05'});assert.equal(weeklyNotes(moved.days,sunday).length,0);assert.equal(weeklyNotes(moved.days,'2026-11-01').length,1);
 const days={...first.days,[friday]:[{id:'weekly-1',minute:600,text:'Keep',done:false}]};const scheduled=changeWeekly(days,sunday,'weekly-1',{kind:'schedule',date:friday,minute:700},()=> 'unique');assert.deepEqual(scheduled.days[friday].map(n=>n.id),['weekly-1','unique']);assert.equal(scheduled.days[friday][0].text,'Keep');
 for(const action of [{kind:'schedule',date:'bad',minute:60},{kind:'schedule',date:friday,minute:1440},{kind:'move',date:'2026-02-30'}])assert.throws(()=>changeWeekly(days,sunday,'weekly-1',action));
});
test('weekly notes survive validated backups and reject invalid anchors',()=>{
 const result=create({});assert.deepEqual(validState({version:1,days:result.days}).days,result.days);
 assert.throws(()=>validState({version:1,days:{[friday]:result.days[sunday]}}));assert.throws(()=>validState({version:1,days:{[sunday]:[{...result.days[sunday][0],weekly:'yes'}]}}));
});
test('weekly notes neither notify, occupy availability, enter Focus, nor match dated bulk selections',()=>{
 const entry={...create({}).days[sunday][0],text:'Undated task',tags:['project']},days={[sunday]:[entry]},at=new Date(2026,9,18,0).getTime();
 assert.deepEqual(dueEntries([entry],sunday,60,at-1000,at),[]);assert.deepEqual(focusIntervalNotes({days,settings:{interval:60}},{date:sunday,minute:0}),[]);assert.equal(findFocusNote(days,entry.id,sunday),null);
 const slots=emptyIntervals(days,{start:sunday,end:sunday,from:0,to:60,weekdays:[0],interval:60},at-1000);assert.equal(slots.length,1);
 assert.deepEqual(matchingNotes(days,sunday,'week',new Set(['project'])),[]);
 const text=shareNoteText(entry,sunday);assert.match(text,/Weekly note/);assert.ok(!text.includes('12:00 AM'));assert.ok(!text.includes('00:00'));
});
test('Monthly Compass creates four undated Weekly Notes and records a separate Daily report',()=>{
 const answers=Object.fromEntries(lifeDimensions.flatMap(([key])=>[[key+'.project',key+' project'],...[1,2,3,4].map(w=>[key+'.week'+w,key+' task '+w])])),report={id:'compass',activity:'compass',completedAt:new Date(2026,9,23,14).getTime(),answers,schedule:{mode:'weekly'}};
 const result=attachGuidedPlan({},60,report),weeks=['2026-10-18','2026-10-25','2026-11-01','2026-11-08'];
 for(const [i,week] of weeks.entries()){const note=weeklyNotes(result.days,week)[0];assert.equal(note.title,compassTitle(friday));assert.equal(note.minute,0);assert.equal(note.tasks.length,5);assert.ok(note.text.includes('task '+(i+1)));}
 assert.equal(Object.values(result.days).flat().filter(note=>!note.weekly).length,1);assert.equal(result.days[friday][0].guidedActivities.length,1);
 assert.deepEqual(validState({version:1,days:result.days}).days,result.days);assert.equal(attachGuidedPlan(result.days,60,report).days,result.days);assert.equal(validGuidedReports([report])[0].schedule.time,undefined);
});
test('attachment backups include files referenced by Weekly Notes',async()=>{
 let result=create({});result=changeWeekly(result.days,sunday,'weekly-1',{kind:'update',values:{attachments:[{id:'f',name:'x.txt',type:'text/plain',size:1}]}});
 const state={version:1,days:result.days},backup=await exportFiles(state,async()=>new Blob(['x']));assert.equal(backup.attachmentFiles.f,'eA==');const restored=prepareFiles(validState(backup),backup.attachmentFiles);assert.equal(restored.state.days[sunday][0].weekly,true);assert.equal(await restored.files[0].blob.text(),'x');
});
