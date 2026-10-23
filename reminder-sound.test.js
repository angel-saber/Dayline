import test from 'node:test';
import assert from 'node:assert/strict';
import {Reminders} from './dist/js/reminders.js';
import {reminderChime} from './dist/js/reminder-chime.js';
import {dayKey} from './dist/js/model.js';
class Audio{
 constructor(){this.src='';this.currentTime=0;this.error=null;this.calls=[];this.listeners={};this.paused=true;}
 addEventListener(key,fn){this.listeners[key]=fn;}
 async play(){this.calls.push(this.src);if(this.blocked)throw Object.assign(new Error('Blocked'),{name:'NotAllowedError'});this.paused=false;}
 pause(){this.paused=true;}
 load(){}
}
function reminder(state={settings:{notifications:true,sound:true,interval:60},days:{}}){const r=new Reminders(()=>state,()=>{},()=>{});clearInterval(r.timer);return r;}
test('a locally generated PCM chime has a valid WAV header and nonzero samples without clipping',()=>{
 const bytes=Buffer.from(reminderChime().split(',')[1],'base64');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt32LE(40),bytes.length-44);assert.equal(bytes.readUInt16LE(34),16);
 let max=0;for(let i=44;i<bytes.length;i+=2)max=Math.max(max,Math.abs(bytes.readInt16LE(i)));assert.ok(max>5000&&max<32767);
 const silent=Buffer.from(reminderChime(true).split(',')[1],'base64');assert.ok(silent.subarray(44).every(value=>value===0));
});
test('manual and delayed chimes reuse the same speaker-playback media element and source',async()=>{
 const original=globalThis.Audio,descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),session={type:'auto'};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:session}});let created=0;
 globalThis.Audio=class extends Audio{constructor(){assert.equal(session.type,'playback');super();created++;}};
 try{const r=reminder();await r.chime();const player=r.audio;await r.chime();assert.equal(r.audio,player);assert.equal(created,1);assert.equal(player.calls.length,2);assert.equal(player.calls[0],player.calls[1]);assert.equal(r.audioReady,true);}
 finally{globalThis.Audio=original;if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('gesture priming uses the same player and restores the audible chime before a reminder',async()=>{
 const original=globalThis.Audio;globalThis.Audio=Audio;
 try{const r=reminder();await r.unlockAudio();assert.equal(r.audioReady,true);const player=r.audio;assert.equal(player.paused,true);assert.notEqual(player.calls[0],player.src);await r.chime();assert.equal(player.calls[1],r.chimeSource);assert.equal(r.audio,player);}
 finally{globalThis.Audio=original;}
});
test('blocked delayed playback clears readiness and reports a browser-specific recovery action',async()=>{
 const original=globalThis.Audio;globalThis.Audio=Audio;
 try{const r=reminder();await r.chime();r.audio.blocked=true;await assert.rejects(r.chime(),/browser blocked.*Test sound/);assert.equal(r.audioReady,false);r.audio.blocked=false;await r.chime();assert.equal(r.audioReady,true);}
 finally{globalThis.Audio=original;}
});
test('a playback promise that never settles times out instead of falsely reporting success',async()=>{
 const original=globalThis.Audio;globalThis.Audio=class extends Audio{play(){return new Promise(()=>{});}};
 try{const r=reminder();await assert.rejects(r.chime(),/did not start/);assert.equal(r.audioReady,false);assert.equal(r.audio.paused,true);}finally{globalThis.Audio=original;}
});
test('10-second test follows the same timer, notification and media playback path as planned notes',async()=>{
 const original=globalThis.Audio,oldNow=Date.now;globalThis.Audio=Audio;let now=new Date(2026,9,23,10).getTime();Date.now=()=>now;
 const date=dayKey(new Date(now)),state={settings:{notifications:true,sound:true,interval:60},days:{[date]:[{id:'plan',minute:601,text:'Planned note',done:false}]}};
 try{const r=reminder(state),due=[];r.onDue=entry=>due.push(entry);await r.chime();const player=r.audio;r.scheduleTest();now+=9999;r.tick();assert.equal(due.length,0);now++;r.tick();await r.playOperation;assert.equal(due[0].title,'Reminder sound test');assert.equal(player.calls.length,2);r.tick();assert.equal(due.length,1);now+=50000;r.tick();await r.playOperation;assert.equal(due[1].id,'plan');assert.equal(player.calls.length,3);assert.equal(r.audio,player);}
 finally{globalThis.Audio=original;Date.now=oldNow;}
});
test('simultaneous due notes chime once, later ticks do not repeat, and sound-off never chimes',()=>{
 const oldNow=Date.now,today=new Date();today.setHours(10,0,0,0);const now=today.getTime(),key=dayKey(today);Date.now=()=>now;
 const state={settings:{notifications:true,sound:true,interval:60},days:{[key]:[{id:'a',minute:600,text:'A',done:false},{id:'b',minute:600,text:'B',done:false}]}};
 try{const r=reminder(state);let count=0;r.chime=async()=>count++;r.last=now-1000;r.tick();assert.equal(count,1);r.tick();assert.equal(count,1);state.settings.sound=false;const silent=reminder(state);silent.chime=async()=>count++;silent.last=now-1000;silent.tick();assert.equal(count,1);}
 finally{Date.now=oldNow;}
});
