import test from 'node:test';
import assert from 'node:assert/strict';
import {noteTags,withTags,matchesNoteType,categoryOptions,validTags,collectTagSettings} from '../../dist/js/features/notes/note-types.js';
import {changeCustomTag} from '../../dist/js/features/notes/tag-settings.js';
import {validState} from '../../dist/js/shared/storage.js';
import {bulkChange,selectionKey,matchingNotes} from '../../dist/js/features/bulk/model.js';
import {shareNoteText} from '../../dist/js/features/sharing/share-note.js';
const old={id:'old',title:'Prep',text:'Keep my text',minute:615,done:false,noteType:'project'};
const multi=withTags({...old,id:'multi'},['project','event','custom:Production']);
const days={'2026-10-23':[old,multi],'2026-10-24':[withTags({...old,id:'next'},['custom:Production','personal'])]};
test('legacy single-tag notes remain compatible and multiple tags are independently retained',()=>{
 assert.deepEqual(noteTags(old),['project']);assert.deepEqual(noteTags(multi),['project','event','custom:Production']);
 assert.deepEqual(validState({version:1,days}).days,days);assert.throws(()=>validTags(['project','project']));assert.throws(()=>validTags(['unknown']));
});
test('multi-tag filters match any selected tag once and correctly distinguish untagged notes',()=>{
 assert.equal(matchesNoteType(multi,new Set(['event'])),true);assert.equal(matchesNoteType(multi,new Set(['none'])),false);assert.equal(matchesNoteType(withTags(old,[]),new Set(['none'])),true);
 assert.equal(matchingNotes(days,'2026-10-23','month',new Set(['project','event'])).length,2);
});
test('default-tag switches hide picker options without removing existing tags, while filters can still find them',()=>{
 const config={disabledDefaults:['event'],custom:['custom:Unused']},picker=categoryOptions(days,config),filters=categoryOptions(days,config,true);
 assert.equal(picker.event,undefined);assert.equal(filters.event,'Event');assert.equal(picker['custom:Unused'],'Unused');assert.deepEqual(noteTags(multi),['project','event','custom:Production']);
 const state=validState({version:1,days,settings:{tags:config}});assert.deepEqual(state.settings.tags,config);
});
test('renaming a custom tag updates all assigned notes and unused registry entries without losing other tags',()=>{
 const before=structuredClone(days),result=changeCustomTag(days,{custom:['custom:Unused']},'custom:Production','Film');
 assert.deepEqual(noteTags(result.days['2026-10-23'][1]),['project','event','custom:Film']);assert.deepEqual(noteTags(result.days['2026-10-24'][0]),['custom:Film','personal']);assert.ok(result.config.custom.includes('custom:Unused'));assert.ok(!result.config.custom.includes('custom:Production'));assert.deepEqual(days,before);
 const merged=changeCustomTag(days,{},'custom:Production','Project');assert.deepEqual(noteTags(merged.days['2026-10-23'][1]),['project','event']);
});
test('deleting a custom tag only removes that tag and preserves all notes, text, and unrelated tags',()=>{
 const result=changeCustomTag(days,{},'custom:Production');assert.deepEqual(noteTags(result.days['2026-10-23'][1]),['project','event']);assert.deepEqual(noteTags(result.days['2026-10-24'][0]),['personal']);assert.equal(result.days['2026-10-23'][1].text,'Keep my text');assert.equal(result.days['2026-10-23'].length,2);assert.deepEqual(collectTagSettings(result.config,result.days).custom,[]);
});
test('bulk add, remove, and replace tags preserve unrelated tags as appropriate',()=>{
 const keys=new Set([selectionKey('2026-10-23','multi')]);
 const added=bulkChange(days,keys,{kind:'category',tags:['admin','project'],mode:'add'});assert.deepEqual(noteTags(added.days['2026-10-23'][1]),['project','event','custom:Production','admin']);
 const removed=bulkChange(days,keys,{kind:'category',tags:['event'],mode:'remove'});assert.deepEqual(noteTags(removed.days['2026-10-23'][1]),['project','custom:Production']);
 const replaced=bulkChange(days,keys,{kind:'category',tags:['event','personal'],mode:'replace'});assert.deepEqual(noteTags(replaced.days['2026-10-23'][1]),['event','personal']);
});
test('shared text includes all chosen tags and the inclusion toggle removes every tag',()=>{
 assert.ok(shareNoteText(multi,'2026-10-23').includes('Project · Event · Production'));assert.ok(!shareNoteText(multi,'2026-10-23',{type:false}).includes('Project · Event · Production'));
});
