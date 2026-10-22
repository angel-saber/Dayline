import test from 'node:test';
import assert from 'node:assert/strict';
import {voice,focusMantras,focusIdeas} from './dist/js/personality.js';
import {dailyQuote} from './dist/js/quotes.js';

test('personality changes authored copy and safely falls back for other text',()=>{
  assert.equal(voice('Make a little progress.','builder'),'Stay locked in. Move it forward.');
  assert.equal(voice('Make a little progress.','founder'),'Make the next move count.');
  assert.equal(voice('Make a little progress.','zen'),'Make a little progress.');
  assert.equal(voice('My personal note','builder'),'My personal note');
  assert.equal(voice('Your timeline','unknown'),'Your timeline');
});
test('each personality gets a stable daily quote that changes the next day',()=>{
  const date=new Date(2026,9,22,10),later=new Date(2026,9,22,22),next=new Date(2026,9,23,10);
  const seen=new Set();
  for(const mode of ['zen','builder','founder']){
    const quote=dailyQuote(date,mode);seen.add(quote);
    assert.equal(quote,dailyQuote(later,mode));
    assert.notEqual(quote,dailyQuote(next,mode));
  }
  assert.equal(seen.size,3);
  assert.equal(dailyQuote(date,'unknown'),dailyQuote(date,'zen'));
});
test('focus suggestions select the voice without altering existing commitment text',()=>{
  const original=['A gentle start.'];
  assert.equal(focusMantras(original,'zen'),original);
  for(const mode of ['builder','founder']){
    assert.ok(focusMantras(original,mode).length>1);
    assert.ok(focusIdeas(original,mode).length>1);
    assert.notEqual(focusMantras(original,mode)[0],original[0]);
  }
  assert.deepEqual(original,['A gentle start.']);
});
