import test from 'node:test';
import assert from 'node:assert/strict';
import {availableHours,validAvailableHours,dailySlotVisible,inputMinute,hourInput} from './dist/js/available-hours.js';
import {validState,load,save} from './dist/js/storage.js';
test('older data keeps its full Daily view and shares the existing default 9-to-5 hours',()=>{
 const old=validState({version:1,days:{},settings:{interval:60}}),hours=availableHours(old.settings);
 assert.deepEqual(hours,{from:540,to:1020,hideBefore:false,hideAfter:false});
 for(let minute=0;minute<1440;minute+=60)assert.equal(dailySlotVisible(minute,60,hours),true);
});
test('Daily hide-before and hide-after work independently and retain overlapping boundary intervals',()=>{
 const hours={from:555,to:1005,hideBefore:true,hideAfter:true};
 assert.equal(dailySlotVisible(480,60,hours),false);assert.equal(dailySlotVisible(540,60,hours),true);assert.equal(dailySlotVisible(960,60,hours),true);assert.equal(dailySlotVisible(1020,60,hours),false);
 assert.equal(dailySlotVisible(0,60,{...hours,hideBefore:false}),true);assert.equal(dailySlotVisible(1380,60,{...hours,hideAfter:false}),true);
 assert.equal(dailySlotVisible(480,60,{...hours,from:540}),false);assert.equal(dailySlotVisible(1020,60,{...hours,to:1020}),false);
});
test('available hours and visibility preferences persist through reload and backup validation without altering notes',()=>{
 const note={id:'late',minute:1380,text:'Keep this note',done:false},hours={from:540,to:1020,hideBefore:true,hideAfter:true};
 const state={version:1,days:{'2026-10-23':[note]},settings:{interval:60,availableHours:hours}};
 const storage={value:null,setItem(key,value){this.value=value;},getItem(){return this.value;}};save(state,storage);const restored=load(storage);
 assert.deepEqual(restored.settings.availableHours,hours);assert.deepEqual(restored.days,state.days);assert.deepEqual(validState(JSON.parse(JSON.stringify(restored))).settings.availableHours,hours);
});
test('midnight is represented as the end of the day and invalid or overnight ranges are rejected',()=>{
 assert.equal(inputMinute('00:00'),0);assert.equal(inputMinute('00:00',true),1440);assert.equal(hourInput(1440),'00:00');assert.equal(inputMinute('09:15'),555);assert.ok(Number.isNaN(inputMinute('24:00')));
 assert.deepEqual(validAvailableHours({from:0,to:1440}),{from:0,to:1440,hideBefore:false,hideAfter:false});
 for(const hours of [null,{from:600,to:600},{from:1200,to:360},{from:-1,to:600},{from:540,to:1441},{from:540,to:600,hideBefore:'true'},{from:540.5,to:600}])assert.throws(()=>validAvailableHours(hours));
 assert.throws(()=>validState({version:1,days:{},settings:{availableHours:{from:1200,to:360}}}));
});
