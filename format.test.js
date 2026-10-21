import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleFormat,editFormat,segments,validFormat,renderFormatted} from './dist/js/format.js';
import {validState,save,load} from './dist/js/storage.js';
import {moveEntry} from './dist/js/model.js';

test('selected styles overlap independently and toggle off without removing other styles',()=>{
  const text='Plan today';
  let marks=toggleFormat(text,[],0,4,'bold');
  marks=toggleFormat(text,marks,2,7,'italic');
  marks=toggleFormat(text,marks,0,4,'bold');
  assert.deepEqual(marks,[{start:2,end:7,italic:true}]);
  marks=toggleFormat(text,marks,0,0,'underline');
  assert.ok(segments(text,marks).every(m=>m.underline));
});
test('each highlight replaces the previous color and can be removed',()=>{
  let marks=[];
  for(const color of ['blue','yellow','green','red']){
    marks=toggleFormat('hello',marks,0,5,'highlight',color);
    assert.deepEqual(marks,[{start:0,end:5,highlight:color}]);
  }
  assert.deepEqual(toggleFormat('hello',marks,0,5,'highlight','red'),[]);
});
test('typing, replacing, deleting and clearing text keep formatting in bounds',()=>{
  const marks=[{start:2,end:5,bold:true}];
  assert.deepEqual(editFormat('abcdef','abXcdef',marks),[{start:3,end:6,bold:true}]);
  assert.deepEqual(editFormat('abcdef','abcdXef',marks),[{start:2,end:6,bold:true}]);
  assert.deepEqual(editFormat('abcdef','abf',marks),[]);
  assert.deepEqual(editFormat('abcdef','',marks),[]);
  assert.deepEqual(editFormat('abcdef','abcdef',marks),marks);
  assert.deepEqual(editFormat('abcdef','abcXYef',marks),[{start:2,end:6,bold:true}]);
});
test('formatting and task state survive storage, backups and movement; old notes still load',()=>{
  const entry={id:'one',text:'Plan today',minute:60,done:false,task:true,format:[{start:0,end:4,bold:true,italic:true,underline:true,highlight:'blue'}]};
  const state={version:1,days:{'2026-10-21':[entry]},settings:{interval:60}};
  let raw;const storage={setItem(k,v){raw=v;},getItem(){return raw;}};
  save(state,storage);assert.deepEqual(load(storage).days['2026-10-21'][0],entry);
  assert.deepEqual(moveEntry([entry],'one',120,60)[0].format,entry.format);
  assert.equal(validState({...state,days:{'2026-10-21':[{id:'old',text:'old note',minute:0,done:false}]}}).days['2026-10-21'][0].text,'old note');
});
test('backups reject corrupt ranges, colors and task types',()=>{
  for(const marks of [[{start:-1,end:1,bold:true}],[{start:0,end:20,bold:true}],[{start:0,end:1,highlight:'url(evil)'}],[{start:0,end:1,bold:'yes'}]])assert.throws(()=>validFormat(marks,'text'));
  assert.throws(()=>validState({version:1,days:{'2026-10-21':[{id:'one',text:'x',minute:0,done:false,task:'yes'}]}}));
});
test('formatted rendering uses literal text nodes, never HTML from notes',()=>{
  const original=globalThis.document;
  globalThis.document={createElement:()=>({style:{}})};
  try{
    const children=[],element={replaceChildren(){children.length=0;},append(child){children.push(child);}};
    const text='<img src=x onerror=alert(1)>';
    renderFormatted(element,text,[{start:0,end:text.length,bold:true,highlight:'red'}]);
    assert.equal(children[0].textContent,text);assert.equal(children[0].innerHTML,undefined);assert.equal(children[0].style.fontWeight,'700');
  }finally{globalThis.document=original;}
});

test('a collapsed formatting selection affects only the cursor line',()=>{
  const text='First line\nSecond line\nThird line';
  for(const [key,value] of [['bold',true],['italic',true],['underline',true],['highlight','green']]){
    const marks=toggleFormat(text,[],15,15,key,value);
    assert.deepEqual(marks,[{start:11,end:22,[key]:value}]);
    assert.deepEqual(toggleFormat(text,marks,15,15,key,value),[]);
  }
  assert.deepEqual(toggleFormat('one\n\nthree',[],4,4,'bold'),[]);
});
