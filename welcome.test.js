import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWelcome} from './dist/js/welcome.js';
const storage=values=>({getItem:key=>values[key]??null});
test('introduction waits for sign-in, then completed setup stays dismissed',()=>{
  assert.equal(needsWelcome(storage({}),false),false);
  assert.equal(needsWelcome(storage({}),true),true);
  assert.equal(needsWelcome(storage({'dayline.welcome.v1':'done'}),true),false);
});
test('guest notes do not consume the introduction before a first sign-in',()=>{
  for(const key of ['dayline.v1','dayline.appearance.v1','dayline.focus.v1']){
    assert.equal(needsWelcome(storage({[key]:'existing'}),false),false);
    assert.equal(needsWelcome(storage({[key]:'existing'}),true),true);
  }
});
test('storage errors never open the introduction for a guest',()=>{
  const blocked={getItem(){throw new Error('blocked');}};
  assert.equal(needsWelcome(blocked,false),false);
  assert.equal(needsWelcome(blocked,true),true);
});
