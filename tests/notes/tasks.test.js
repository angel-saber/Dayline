import test from 'node:test';
import assert from 'node:assert/strict';
import {lineRange,toggleTask,editTasks,noteTasks,validTasks} from '../../dist/js/features/notes/formatting/tasks.js';
import {validState,load,save} from '../../dist/js/shared/storage.js';
import {moveEntry} from '../../dist/js/shared/schedule.js';

test('checkbox affects only the current line, including blank lines and line boundaries',()=>{
  const text='one\ntwo\n\nlast';
  assert.deepEqual(lineRange(text,0),{start:0,end:3});
  assert.deepEqual(lineRange(text,3),{start:0,end:3});
  assert.deepEqual(lineRange(text,4),{start:4,end:7});
  let tasks=toggleTask(text,[],5);
  assert.deepEqual(tasks,[{start:4,done:false}]);
  tasks=toggleTask(text,tasks,8);
  assert.deepEqual(tasks,[{start:4,done:false},{start:8,done:false}]);
  assert.deepEqual(toggleTask(text,tasks,4),[{start:8,done:false}]);
});
test('independent checked states stay attached when preceding text changes',()=>{
  const tasks=[{start:4,done:true},{start:8,done:false}];
  assert.deepEqual(editTasks('one\ntwo\nthree','long first\ntwo\nthree',tasks),[{start:11,done:true},{start:15,done:false}]);
  assert.deepEqual(editTasks('one\ntwo\nthree','one\nthree',tasks,{start:4,end:8}),[{start:4,done:false}]);
  assert.deepEqual(editTasks('one\ntwo\nthree','one\ntwo\nthree',tasks),tasks);
});
test('empty lines can become tasks before typing',()=>{
  const tasks=toggleTask('one\n',[],4);
  assert.deepEqual(editTasks('one\n','one\nnew task',tasks),[{start:4,done:false}]);
});
test('tasks survive reload, backups and reordering without changing plain text',()=>{
  const entry={id:'line-task',text:'Intro\nTask\nFooter',minute:60,done:false,task:false,tasks:[{start:6,done:true}]};
  const state={version:1,days:{'2026-10-21':[entry]},settings:{interval:60}};
  let raw;const storage={setItem(k,v){raw=v;},getItem(){return raw;}};
  save(state,storage);assert.deepEqual(load(storage).days['2026-10-21'][0],entry);
  assert.deepEqual(validState(state).days['2026-10-21'][0],entry);
  assert.deepEqual(moveEntry([entry],entry.id,120,60)[0].tasks,entry.tasks);
});
test('old whole-note tasks migrate to the first line with completion intact',()=>{
  assert.deepEqual(noteTasks({text:'old\nnote',done:true}),[{start:0,done:true}]);
  assert.deepEqual(noteTasks({text:'ordinary',task:false}),[]);
  assert.deepEqual(noteTasks({text:'new',tasks:[],done:true}),[]);
});
test('invalid line offsets, duplicate tasks and nonboolean states fail validation',()=>{
  for(const tasks of [[{start:1,done:false}],[{start:9,done:false}],[{start:0,done:'yes'}],[{start:0,done:true},{start:0,done:false}]])assert.throws(()=>validTasks(tasks,'abc\ndef'));
});
