import test from 'node:test';
import assert from 'node:assert/strict';
import {FocusAudio} from './dist/js/focus-audio.js';
class MockContext{
  constructor(){this.sampleRate=8000;this.currentTime=1;this.destination={};this.nodes=[];}
  async resume(){}
  createGain(){const node={gain:{value:0,cancelScheduledValues(){},setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value,time){this.ramp={value,time};}},connect(){},disconnect(){}};return node;}
  source(){const node={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};this.nodes.push(node);return node;}
  createOscillator(){return Object.assign(this.source(),{frequency:{value:0}});}
  createStereoPanner(){return {pan:{value:0},connect(){}};}
  createBiquadFilter(){return {frequency:{value:0},connect(){}};}
  createBuffer(channels,length,sampleRate){const data=new Float32Array(length);return {length,sampleRate,getChannelData(){return data;}};}
  createBufferSource(){return this.source();}
}
const settings={binaural:true,ambient:true,metronome:true,beat:6,bpm:80,tonesVolume:20,ambientVolume:20,metronomeVolume:50};
test('audio generates separate stereo tones and a steady looping metronome, then stops cleanly',async()=>{
  const original=globalThis.AudioContext;globalThis.AudioContext=MockContext;
  try{
    const audio=new FocusAudio();await audio.play(settings);
    assert.equal(audio.playing,true);assert.equal(audio.sources.length,4);assert.equal(audio.sources[0].frequency.value,180);assert.equal(audio.sources[1].frequency.value,186);
    const metronome=audio.sources.at(-1);assert.equal(metronome.loop,true);assert.equal(metronome.buffer.length,8000*3);
    const previous=[...audio.sources];await audio.play({...settings,bpm:120});assert.ok(previous.every(s=>s.stopped));assert.equal(audio.sources.at(-1).buffer.length,8000*2);
    const final=[...audio.sources];audio.stop();assert.equal(audio.playing,false);assert.ok(final.every(s=>s.stopped));
  }finally{globalThis.AudioContext=original;}
});
test('finishing schedules a fade to silence and stops every source',async()=>{
  const original=globalThis.AudioContext;globalThis.AudioContext=MockContext;
  try{const audio=new FocusAudio();await audio.play(settings);const sources=[...audio.sources],gain=audio.master.gain;await audio.fadeOut();assert.equal(gain.ramp.value,0);assert.equal(gain.ramp.time,1.75);assert.equal(audio.playing,false);assert.ok(sources.every(s=>s.stopped));}
  finally{globalThis.AudioContext=original;}
});
