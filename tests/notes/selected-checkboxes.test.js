import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCheckbox} from '../../dist/js/features/notes/editor-state.js';
const note=text=>({text,tasks:[],bullets:[],format:[]});
test('selected lines each receive an independent checkbox, without affecting the next unselected line',()=>{
 const state=note('First\nSecond\nThird\nLast');
 const result=applyCheckbox(state,2,18);
 assert.deepEqual(result.tasks,[{start:0,done:false},{start:6,done:false},{start:13,done:false}]);assert.equal(result.text,state.text);assert.deepEqual(state.tasks,[]);
 assert.deepEqual(applyCheckbox(result,2,18).tasks,[]);
});
test('mixed selections keep existing completion and add missing checkboxes while replacing selected bullets',()=>{
 const state={...note('First\nSecond\nThird\nLast'),tasks:[{start:0,done:true},{start:19,done:true}],bullets:[{start:6},{start:13}]};
 const result=applyCheckbox(state,0,13);
 assert.deepEqual(result.tasks,[{start:0,done:true},{start:6,done:false},{start:19,done:true}]);assert.deepEqual(result.bullets,[{start:13}]);
 assert.deepEqual(applyCheckbox(result,0,13).tasks,[{start:19,done:true}]);
});
test('blank selected lines receive checkboxes, and no selection still toggles only the current line',()=>{
 const state=note('One\n\nThree');assert.deepEqual(applyCheckbox(state,0,5).tasks,[{start:0,done:false},{start:4,done:false}]);
 assert.deepEqual(applyCheckbox(state,6).tasks,[{start:5,done:false}]);
 assert.deepEqual(applyCheckbox(note(''),0).tasks,[{start:0,done:false}]);
});
