import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceText,applyStyle,applyCheckbox,checkTask,selectionStyle} from './dist/js/editor-state.js';
import {validState} from './dist/js/storage.js';
const note=(text)=>({text,format:[],tasks:[]});

test('direct typing keeps formatting inline and does not format another line',()=>{
  let state=applyStyle(note('Intro\nTask\nClosing'),8,8,'bold');
  state=applyCheckbox(state,8);
  state=replaceText(state,10,10,' today');
  assert.equal(state.text,'Intro\nTask today\nClosing');
  assert.deepEqual(state.format,[{start:6,end:16,bold:true}]);
  assert.deepEqual(state.tasks,[{start:6,done:false}]);
  assert.deepEqual(selectionStyle(state,2,2),{});
  assert.deepEqual(selectionStyle(state,9,9),{bold:true});
});
test('formatting selected text and exact replacement keep repeated lines independent',()=>{
  let state=applyStyle(note('same\nsame\nsame'),5,9,'italic');
  state=applyCheckbox(state,6);
  state=replaceText(state,5,10,'');
  assert.equal(state.text,'same\nsame');
  assert.deepEqual(state.tasks,[]);
  assert.deepEqual(state.format,[]);
});
test('a checkbox on a blank line stays on that line when typing starts',()=>{
  let state=applyCheckbox(note('Intro\n'),6);
  state=replaceText(state,6,6,'Task',{bold:true,highlight:'yellow'});
  assert.deepEqual(state.format,[{start:6,end:10,bold:true,highlight:'yellow'}]);
  assert.deepEqual(state.tasks,[{start:6,done:false}]);
  state=checkTask(state,6);assert.equal(state.tasks[0].done,true);
  assert.equal(state.text,'Intro\nTask');
});
test('Enter starts a normal new line without an extra checkbox',()=>{
  let state=applyStyle(note('Task'),2,2,'underline');state=applyCheckbox(state,0);
  state=replaceText(state,4,4,'\n');state=replaceText(state,5,5,'Normal');
  assert.deepEqual(state.tasks,[{start:0,done:false}]);
  assert.deepEqual(selectionStyle(state,8,8),{});
});
test('explicit plain typing overrides an inherited style without changing its neighbors',()=>{
  let state=applyStyle(note('abcd'),0,4,'bold');
  state=replaceText(state,2,2,'plain',{});
  assert.deepEqual(state.format,[{start:0,end:2,bold:true},{start:7,end:9,bold:true}]);
});
test('direct editor model remains a valid backup with literal HTML and multiline paste',()=>{
  let state=replaceText(note(''),0,0,'<script>literal</script>\nTask');state=applyCheckbox(state,25);
  const entry={id:'direct',minute:120,done:false,task:false,...state};
  assert.deepEqual(validState({version:1,days:{'2026-10-21':[entry]}}).days['2026-10-21'][0],entry);
});
