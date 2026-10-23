import test from 'node:test';
import assert from 'node:assert/strict';
import {Reminders} from './dist/js/reminders.js';
import {dayKey} from './dist/js/model.js';
class Audio{
 constructor(){this.state='suspended';this.currentTime=5;this.destination={};this.tones=[];this.listeners={};}
 addEventListener(key,fn){this.listeners[key]=fn;}
 async resume(){this.state='running';this.listeners.statechange?.();}
 createOscillator(){const tone={frequency:{},connect(){},disconnect(){this.disconnected=true;},start(time){this.started=time;},stop(time){this.stopped=time;}};this.tones.push(tone);return tone;}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
}
function reminder(state={settings:{notifications:true,sound:true,interval:60},days:{}}){const r=new Reminders(()=>state,()=>{},()=>{});clearInterval(r.timer);return r;}
test('reminder chime requests speaker playback, unlocks audio, schedules audible tones and cleans up nodes',async()=>{
 const original=globalThis.AudioContext,descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),session={type:'auto'};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:session}});
 globalThis.AudioContext=class extends Audio{constructor(){assert.equal(session.type,'playback');super();}};
 try{const r=reminder();await r.chime();assert.equal(r.audioReady,true);assert.deepEqual(r.audio.tones.map(t=>t.frequency.value),[660,880]);assert.ok(r.audio.tones.every(t=>t.stopped>t.started));r.audio.tones.forEach(t=>{t.onended();assert.equal(t.disconnected,true);});}
 finally{globalThis.AudioContext=original;if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('suspended audio is resumed again and closed contexts are recreated',async()=>{
 const original=globalThis.AudioContext;globalThis.AudioContext=Audio;
 try{const r=reminder();await r.unlockAudio();const first=r.audio;first.state='interrupted';assert.equal(r.audioReady,false);await r.unlockAudio();assert.equal(r.audio,first);assert.equal(r.audioReady,true);first.state='closed';await r.chime();assert.notEqual(r.audio,first);assert.equal(r.audio.tones.length,2);}
 finally{globalThis.AudioContext=original;}
});
test('blocked audio reports failure instead of claiming the chime played, and can be retried',async()=>{
 const original=globalThis.AudioContext;globalThis.AudioContext=class extends Audio{async resume(){}};
 try{const r=reminder();await assert.rejects(r.chime(),/paused/);assert.equal(r.audio.tones.length,0);r.audio.resume=Audio.prototype.resume;await r.chime();assert.equal(r.audio.tones.length,2);}
 finally{globalThis.AudioContext=original;}
});
test('a browser resume promise that never settles times out with an actionable error',async()=>{
 const original=globalThis.AudioContext;globalThis.AudioContext=class extends Audio{resume(){return new Promise(()=>{});}};
 try{await assert.rejects(reminder().chime(),/Click Test sound/);}finally{globalThis.AudioContext=original;}
});
test('simultaneous due notes chime once, later ticks do not repeat, and sound-off never chimes',()=>{
 const oldNow=Date.now,today=new Date();today.setHours(10,0,0,0);const now=today.getTime(),key=dayKey(today);Date.now=()=>now;
 const state={settings:{notifications:true,sound:true,interval:60},days:{[key]:[{id:'a',minute:600,text:'A',done:false},{id:'b',minute:600,text:'B',done:false}]}};
 try{const r=reminder(state);let count=0;r.chime=async()=>count++;r.last=now-1000;r.tick();assert.equal(count,1);r.tick();assert.equal(count,1);state.settings.sound=false;const silent=reminder(state);silent.chime=async()=>count++;silent.last=now-1000;silent.tick();assert.equal(count,1);}
 finally{Date.now=oldNow;}
});
