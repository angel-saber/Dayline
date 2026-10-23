import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceText,recognizeBullets,insertLineBreak} from './dist/js/editor-state.js';
import {validState} from './dist/js/storage.js';
const note=text=>({text,format:[],tasks:[],bullets:[]});
test('a space after a typed list marker immediately produces a native bullet and correct caret',()=>{
 for(const marker of ['-','*','+','•']){
  const before=note(marker),next=replaceText(before,1,1,' '),result=recognizeBullets(next,1,2);
  assert.equal(result.state.text,'');assert.deepEqual(result.state.bullets,[{start:0}]);assert.deepEqual(result.selection,{start:0,end:0});
  const typed=replaceText(result.state,0,0,'Task');assert.equal(typed.text,'Task');assert.deepEqual(typed.bullets,[{start:0}]);
  assert.deepEqual(insertLineBreak(typed,4,4).state.bullets,[{start:0},{start:5}]);
 }
});
test('pasted lists normalize each touched line and shift existing styles and checkbox anchors safely',()=>{
 const text='- First\n* Second\nPlain\n• Third\nCheckbox';
 const state={...note(text),format:[{start:2,end:7,bold:true}],tasks:[{start:31,done:true}]};
 const result=recognizeBullets(state,0,29,{start:29,end:29});
 assert.equal(result.state.text,'First\nSecond\nPlain\nThird\nCheckbox');assert.deepEqual(result.state.bullets,[{start:0},{start:6},{start:19}]);assert.deepEqual(result.state.format,[{start:0,end:5,bold:true}]);assert.deepEqual(result.state.tasks,[{start:25,done:true}]);assert.equal(result.selection.start,23);
 const restored=validState({version:1,days:{'2026-10-23':[{...result.state,id:'n',minute:0,done:false}]}});assert.deepEqual(restored.days['2026-10-23'][0].bullets,result.state.bullets);
});
test('ordinary punctuation, mid-line text, deletion and checkbox contents are not converted',()=>{
 for(const text of ['-','*','+','•','-5 degrees','a - task','2 * 3','https://example.com/a-b'])assert.deepEqual(recognizeBullets(note(text),0,text.length).state,note(text));
 const task={...note('- Task'),tasks:[{start:0,done:true}]};assert.deepEqual(recognizeBullets(task,0,6).state,task);
 const state=note('- Existing\nPlain');assert.deepEqual(recognizeBullets(state,12,16).state,state);
});
test('retyping markers on an existing bullet does not create duplicates or affect other notes',()=>{
 const state={...note('Intro\n- Task'),bullets:[{start:6}]};const result=recognizeBullets(state,6,8,{start:8,end:8});
 assert.equal(result.state.text,'Intro\nTask');assert.deepEqual(result.state.bullets,[{start:6}]);assert.equal(result.selection.start,6);assert.equal(state.text,'Intro\n- Task');
});
