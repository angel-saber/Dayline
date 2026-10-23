import test from 'node:test';
import assert from 'node:assert/strict';
import {shareNotesText} from './dist/js/share-note.js';
const item=(id,date,minute,tags)=>({date,entry:{id,title:id,text:'Contents for '+id,minute,tags,done:false,task:false}});
const items=[item('PROJECT-LATE','2026-10-24',700,['project']),item('COMBINED-LATE','2026-10-24',615,['event','project']),item('ADMIN','2026-10-25',600,['admin']),item('COMBINED-EARLY','2026-10-23',615,['project','event']),item('NO-TAGS','2026-10-20',500,[]),item('PROJECT-EARLY','2026-10-23',645,['project'])];
test('category order groups canonical tag combinations once and sorts notes chronologically inside each group',()=>{
 const before=structuredClone(items),text=shareNotesText(items,{organize:'category'},'24');
 assert.ok(text.indexOf('\nAdmin\n')<text.indexOf('\nProject\n'));assert.ok(text.indexOf('\nProject\n')<text.indexOf('\nProject + Event\n'));assert.ok(text.indexOf('\nProject + Event\n')<text.indexOf('\nUntagged\n'));
 assert.equal(text.split('\nProject + Event\n').length-1,1);assert.ok(text.indexOf('10:15 — COMBINED-EARLY')<text.indexOf('10:15 — COMBINED-LATE'));assert.ok(text.indexOf('10:45 — PROJECT-EARLY')<text.indexOf('11:40 — PROJECT-LATE'));
 for(const {entry} of items)assert.equal(text.split(' — '+entry.title+'\n').length-1,1);
 assert.deepEqual(items,before);assert.equal(text.split('Planned with Dayline').length-1,1);
});
test('category sorting preserves inclusion choices and hides tags when Tags is off',()=>{
 const text=shareNotesText(items,{organize:'category',type:false,dateTime:false},'24','My plan');assert.ok(text.startsWith('My plan\n'));assert.ok(!text.includes('Project + Event'));assert.ok(!text.includes('\nAdmin\n'));assert.ok(!text.includes('2026'));assert.ok(!text.includes('10:15'));assert.ok(text.includes('Contents for COMBINED-EARLY'));
});
test('date ordering remains the default and custom category groups are supported',()=>{
 const chronological=shareNotesText(items);assert.ok(chronological.indexOf('NO-TAGS')<chronological.indexOf('ADMIN'));
 const text=shareNotesText([item('custom','2026-10-23',600,['custom:Film prep','project'])],{organize:'category'});assert.ok(text.includes('\nProject + Film prep\n'));
});
