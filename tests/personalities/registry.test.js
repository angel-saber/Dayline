import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PERSONALITIES,voice,getPersonality} from '../../dist/js/personalities/index.js';
import {musicLength,renderMusic,musicProfile} from '../../dist/js/features/focus/music.js';

test('every authored copy ID is available in every personality and all HTML references resolve',()=>{
  const keys=Object.keys(PERSONALITIES.zen.copy).sort();
  for(const [id,value] of Object.entries(PERSONALITIES)){
    assert.equal(value.id,id);assert.deepEqual(Object.keys(value.copy).sort(),keys);
    assert.ok(value.name&&value.description&&value.welcome.title&&value.mantras.length&&value.quotes.length);
    assert.equal(musicProfile(id).layout,id);
    for(const key of keys)assert.ok(value.copy[key].length>0);
  }
  const html=readFileSync(new URL('../../dist/index.html',import.meta.url),'utf8');
  for(const [,key] of html.matchAll(/data-voice="([^"]+)"/g))assert.ok(keys.includes(key),key);
  assert.equal(voice('daily.headingToday','builder'),'STUDY CAREFULLY. BUILD DELIBERATELY.');
  assert.equal(getPersonality('unrecognized'),PERSONALITIES.zen);
});

test('moving procedural scores preserves the exact original audio samples',()=>{
  const expected={zen:'de2f256064a0af797747c2b97505dc0b9f3df0de4f489eac731c23ae9ca9cc31',builder:'7b0bdd4d2682c89ac2b44419feed44a497ad6440c3fe702e89feb2b00b57c3e7',founder:'70bfca194f50201126660bd64d723d7fa48236c98a6dd38ebbbc1a089143f3c9'};
  for(const mode of Object.keys(expected)){
    const data=new Float32Array(musicLength(256,mode));renderMusic(data,256,mode);
    assert.equal(createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex'),expected[mode],mode);
  }
});
