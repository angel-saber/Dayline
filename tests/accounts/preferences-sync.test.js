import test from 'node:test';
import assert from 'node:assert/strict';
import {PreferencesSync,sharedPreferences} from '../../dist/js/features/accounts/preferences-sync.js';
const initial=sharedPreferences({interval:60,clock:'12',notifications:false,sound:false},'zen');
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size;}};}
function server(){let row=null;return {async loadPreferences(){return structuredClone(row);},async savePreferences(preferences,revision){if(revision!==(row?.revision||0))return {conflict:true,...structuredClone(row)};row={preferences:structuredClone(preferences),revision:revision+1};return {conflict:false,revision:row.revision};},get row(){return row;}};}
function client(cloud,extra={}){return new PreferencesSync({cloud,userId:'user',initial,storage:storage(),...extra});}

test('existing device settings are not silently replaced or uploaded before initial choice',async()=>{
 const cloud=server(),a=client(cloud);await a.sync();assert.equal(cloud.row,null);assert.deepEqual(a.values,initial);
 a.stage({...initial,interval:30,layout:'builder'},true);await a.sync();
 const b=client(cloud);await b.sync();assert.equal(b.values.interval,30);assert.equal(b.values.layout,'builder');assert.equal(b.pending,false);a.stop();b.stop();
});
test('independent device changes merge by field and an in-flight edit is not lost',async()=>{
 const cloud=server(),a=client(cloud),b=client(cloud);a.stage(initial,true);await a.sync();await b.sync();
 a.stage({...a.values,clock:'24'});b.stage({...b.values,interval:15});await a.sync();await b.sync();await a.sync();
 assert.equal(cloud.row.preferences.clock,'24');assert.equal(cloud.row.preferences.interval,15);
 let release;const original=cloud.savePreferences;cloud.savePreferences=async(...args)=>{await new Promise(r=>release=r);cloud.savePreferences=original;return original(...args);};
 a.stage({...a.values,sound:true});const pending=a.sync();while(!release)await new Promise(r=>setTimeout(r,0));a.stage({...a.values,layout:'founder'});release();await pending;
 assert.equal(cloud.row.preferences.sound,true);assert.equal(cloud.row.preferences.layout,'founder');a.stop();b.stop();
});
test('failed settings requests keep an offline draft and never write note storage',async()=>{
 const local=storage(),cloud=server();local.setItem('dayline.v1','original notes');const a=client(cloud,{storage:local});
 a.stage({...initial,interval:120});const load=cloud.loadPreferences;cloud.loadPreferences=async()=>{throw new Error('offline');};await assert.rejects(a.sync(),/offline/);a.stop();
 cloud.loadPreferences=load;const recovered=client(cloud,{storage:local});await recovered.sync();assert.equal(cloud.row.preferences.interval,120);assert.equal(local.getItem('dayline.v1'),'original notes');recovered.stop();
});
test('a stale save retries against the newer revision without reverting other fields',async()=>{
 const cloud=server(),a=client(cloud);a.stage(initial,true);await a.sync();
 const original=cloud.savePreferences;let conflict=true;cloud.savePreferences=async(value,revision)=>{if(conflict){conflict=false;await original({...initial,clock:'24'},revision);}return original(value,revision);};
 a.stage({...a.values,interval:45});await a.sync();assert.equal(cloud.row.preferences.interval,45);assert.equal(cloud.row.preferences.clock,'24');a.stop();
});
