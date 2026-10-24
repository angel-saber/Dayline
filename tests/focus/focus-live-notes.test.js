import test from 'node:test';
import assert from 'node:assert/strict';
import {focusIntervalNotes,newFocus,attachFocusReport} from '../../dist/js/features/focus/model.js';
const page={date:'2026-10-23',minute:600,interval:60};
const state={settings:{interval:60},days:{'2026-10-23':[{id:'b',minute:645,text:'Second',done:false},{id:'a',minute:615,text:'First',done:false},{id:'outside',minute:660,text:'Next interval',done:false}]}};
test('Focus holds all notes in its interval in exact-time order without changing planner order',()=>{
 assert.deepEqual(focusIntervalNotes(state,page).map(e=>e.id),['a','b']);assert.equal(state.days[page.date][0].id,'b');
});
test('Focus reads current planner data after edits, additions, removals, and moves',()=>{
 const next=structuredClone(state);next.days[page.date][1].text='Changed from Daily';assert.equal(focusIntervalNotes(next,page)[0].text,'Changed from Daily');
 next.days[page.date].push({id:'new',minute:630,text:'Added from Monthly',done:false});assert.deepEqual(focusIntervalNotes(next,page).map(e=>e.id),['a','new','b']);
 next.days[page.date]=next.days[page.date].filter(e=>e.id!=='a');next.days[page.date].find(e=>e.id==='b').minute=700;assert.deepEqual(focusIntervalNotes(next,page).map(e=>e.id),['new']);
});
test('new Focus sessions select an existing note while retaining access to every interval note',()=>{
 const at=new Date(2026,9,23,10,20).getTime(),session=newFocus(state,at,'session','owner');assert.equal(session.pages[0].noteId,'a');assert.equal(focusIntervalNotes(state,session.pages[0]).length,2);
 session.phase='active';session.startedAt=at;session.endedAt=at+1000;session.pages[0].noteId='b';
 const days=attachFocusReport(state.days,session);assert.equal(days[page.date].find(e=>e.id==='b').focusReports.length,1);assert.equal(days[page.date].find(e=>e.id==='a').focusReports,undefined);
});
