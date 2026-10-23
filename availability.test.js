import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyIntervals,mergeAvailability,availabilityText,validTimeZone} from './dist/js/availability-model.js';
const options={start:'2026-10-26',end:'2026-10-26',from:540,to:1020,weekdays:[1,2,3,4,5],interval:60};
const choose=slots=>new Set(slots.map(slot=>slot.key));
test('every kind of note blocks its entire interval, regardless of contents or exact minute',()=>{
 const days={'2026-10-26':[{id:'a',minute:555,text:'Meeting',done:false},{id:'b',minute:600,text:'Finished',done:true},{id:'c',minute:675,text:'',title:'Title only'},{id:'d',minute:720,text:'',attachments:[{id:'file'}]},{id:'e',minute:780,text:'',focusReports:[{}]},{id:'f',minute:840,text:''}]};
 const slots=emptyIntervals(days,options);assert.deepEqual(slots.map(slot=>slot.minute),[900,960]);assert.equal(days['2026-10-26'].length,6);
});
test('adjacent selected intervals merge, leaving gaps for occupied or deselected intervals',()=>{
 const slots=emptyIntervals({},options),selection=choose(slots);selection.delete(slots[2].key);
 assert.deepEqual(mergeAvailability(slots,selection).map(slot=>[slot.minute,slot.endMinute]),[[540,660],[720,1020]]);
 assert.equal(mergeAvailability(slots,new Set()).length,0);
});
test('weekday filters and working-hour boundaries select only whole intervals; custom final slots remain valid',()=>{
 const slots=emptyIntervals({},{...options,start:'2026-10-23',end:'2026-10-26',from:570,to:1010});
 assert.equal(slots.length,12);assert.ok(slots.every(slot=>[600,660,720,780,840,900].includes(slot.minute)));assert.ok(slots.every(slot=>['2026-10-23','2026-10-26'].includes(slot.date)));
 const uneven=emptyIntervals({},{...options,interval:47,from:0,to:1440});assert.equal(uneven.at(-1).endMinute,1440);assert.equal(uneven.length,31);
});
test('invalid dates, reversed dates, excessive ranges, invalid hours and empty weekdays fail clearly',()=>{
 for(const changes of [{start:'2026-02-30'},{start:'2026-10-27'},{end:'2026-11-26'},{from:1020,to:540},{weekdays:[]},{interval:0},{to:1441}])assert.throws(()=>emptyIntervals({},{...options,...changes}));
 assert.equal(new Set(emptyIntervals({},{...options,end:'2026-11-25'}).map(slot=>slot.date)).size,23);
});
test('shares expose only availability, include time zone and snapshot, and revalidation removes newly occupied slots',()=>{
 const slots=emptyIntervals({},options),selected=choose(slots),text=availabilityText(slots,selected,{timeZone:'UTC',now:Date.UTC(2026,9,23,12)});
 assert.match(text,/My availability/);assert.match(text,/Time zone: UTC/);assert.match(text,/Availability as of/);assert.match(text,/Please confirm before booking/);
 const updated=emptyIntervals({'2026-10-26':[{minute:540,text:'PRIVATE SECRET'}]},options);
 assert.equal(mergeAvailability(updated,selected)[0].minute,600);assert.ok(!availabilityText(updated,selected,{timeZone:'UTC'}).includes('PRIVATE SECRET'));
 assert.equal(availabilityText(slots,new Set(),{timeZone:'UTC'}),'');assert.equal(validTimeZone('Not/AZone'),false);assert.throws(()=>availabilityText(slots,selected,{timeZone:'Not/AZone'}));
});
test('time-zone conversion groups by the displayed date and identifies midnight-crossing ranges',()=>{
 const candidates=[{key:'one',date:'2026-10-26',minute:0,endMinute:120,startAt:Date.UTC(2026,9,26,6),endAt:Date.UTC(2026,9,26,8)}];
 const text=availabilityText(candidates,new Set(['one']),{timeZone:'America/Los_Angeles',clock:'24',now:Date.UTC(2026,9,23)});
 assert.match(text,/Sunday, October 25, 2026/);assert.match(text,/Monday, October 26, 2026/);assert.match(text,/23:00/);assert.match(text,/1:00|01:00/);
});
test('separate days never merge even when their real endpoints touch',()=>{
 const slots=emptyIntervals({},{...options,end:'2026-10-27',from:0,to:1440});assert.equal(mergeAvailability(slots,choose(slots)).length,2);
});

test('daylight-saving transitions skip nonexistent slots and block repeated-hour occupancy',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {emptyIntervals} from './dist/js/availability-model.js';
 const settings={from:0,to:240,weekdays:[0],interval:60};
 const spring=emptyIntervals({},{...settings,start:'2026-03-08',end:'2026-03-08'});
 if(JSON.stringify(spring.map(slot=>slot.minute))!=='[0,60,180]')throw new Error('Nonexistent spring hour included');
 const fall=emptyIntervals({'2026-11-01':[{minute:75,text:'Meeting'}]},{...settings,start:'2026-11-01',end:'2026-11-01'});
 if(fall.some(slot=>slot.minute===60))throw new Error('Repeated occupied hour included');
 `],{cwd:process.cwd(),env:{...process.env,TZ:'America/Los_Angeles'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
