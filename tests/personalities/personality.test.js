import test from 'node:test';
import assert from 'node:assert/strict';
import {voice,focusMantras,focusIdeas,PERSONALITY_MANTRAS} from '../../dist/js/personalities/index.js';
import {MANTRAS,newFocus,commitFocus,validFocusDraft} from '../../dist/js/features/focus/model.js';
import {dailyQuote} from '../../dist/js/personalities/quotes.js';

test('personality changes authored copy and safely falls back for other text',()=>{
  assert.equal(voice('Make a little progress.','builder'),'Work carefully. Build steadily.');
  assert.equal(voice('Make a little progress.','founder'),'Make the next move count.');
  assert.equal(voice('Make a little progress.','zen'),'Breathe. Return to this step.');
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
  assert.equal(focusMantras(original,'unknown'),original);
  for(const mode of ['zen','builder','founder']){
    assert.ok(focusMantras(original,mode).length>1);
    assert.ok(focusIdeas(original,mode).length>1);
    assert.notEqual(focusMantras(original,mode)[0],original[0]);
  }
  assert.deepEqual(original,['A gentle start.']);
});

test('approved instructional mantras replace the old lists in all three modes',()=>{
  assert.deepEqual(Object.values(PERSONALITY_MANTRAS).map(pool=>pool.length),[10,11,9]);
  assert.deepEqual(MANTRAS,PERSONALITY_MANTRAS.zen);
  assert.ok(focusMantras([],'zen').includes('Inhale positivity. Exhale negativity.'));
  assert.ok(focusMantras([],'builder').includes('Lay one solid brick at a time.'));
  assert.ok(focusMantras([],'builder').includes('Find the load-bearing task. Build it first.'));
  assert.ok(focusMantras([],'founder').includes('Find the leverage. Make the move that strengthens your position.'));
  assert.ok(focusMantras([],'founder').includes('Read the board before you react. Respond with intention.'));
  for(const pool of Object.values(PERSONALITY_MANTRAS)){
    assert.equal(new Set(pool).size,pool.length);
    assert.ok(pool.every(line=>!line.includes('?')));
    assert.ok(pool.every(line=>!['Hold the vision. Build in stages.','Find the leverage. Move precisely.','Let it be imperfect. Let it be done.'].includes(line)));
  }
});

test('restoring existing or custom commitments never rewrites them to a new suggestion',()=>{
  const state={version:1,days:{},settings:{interval:60}};
  const now=new Date(2026,9,23,10).getTime();
  for(const mantra of ['Find the leverage. Move precisely.','My own commitment.']){
    const draft=newFocus(state,now,'voice-test','test-tab');
    draft.mantra=mantra;commitFocus(draft,state,now);
    assert.equal(validFocusDraft(JSON.parse(JSON.stringify(draft))).mantra,mantra);
  }
});
