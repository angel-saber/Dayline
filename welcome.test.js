import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWelcome} from './dist/js/welcome.js';
const storage=values=>({getItem:key=>values[key]??null});
test('fresh devices see setup; completed setup stays dismissed',()=>{
  assert.equal(needsWelcome(storage({})),true);
  assert.equal(needsWelcome(storage({'dayline.welcome.v1':'done'})),false);
});
test('existing planner data, appearance choices, or focus drafts skip first-visit setup',()=>{
  for(const key of ['dayline.v1','dayline.appearance.v1','dayline.focus.v1'])assert.equal(needsWelcome(storage({[key]:'existing'})),false);
});
test('unavailable storage does not prevent first-visit introduction',()=>{
  assert.equal(needsWelcome({getItem(){throw new Error('blocked');}}),true);
});
