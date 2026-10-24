import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLink,detectedLinks} from '../../dist/js/features/notes/formatting/links.js';
import {setLink,toggleFormat,editFormat,validFormat,renderFormatted} from '../../dist/js/features/notes/formatting/format.js';
import {validState} from '../../dist/js/shared/storage.js';
test('only http/https destinations are accepted and ordinary domains gain https',()=>{
 assert.equal(safeLink('example.com/path'),'https://example.com/path');assert.equal(safeLink('https://example.com'),'https://example.com/');
 for(const value of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','ftp://example.com','https://user:pass@example.com','https://exa mple.com','not a link'])assert.equal(safeLink(value),null);
});
test('typed and pasted URLs become links without trailing sentence punctuation or unbalanced brackets',()=>{
 const text='Visit https://example.com/test, (www.example.org/page). Also example.net/a_(b). mail@example.com';
 const links=detectedLinks(text);assert.deepEqual(links.map(l=>text.slice(l.start,l.end)),['https://example.com/test','www.example.org/page','example.net/a_(b)']);
});
test('hyperlinks coexist with bold and highlight, can be edited or removed, and survive text edits and backup validation',()=>{
 const text='My portfolio today';let format=setLink(text,[],0,12,'example.com');format=toggleFormat(text,format,0,2,'bold');format=toggleFormat(text,format,0,12,'highlight','yellow');
 assert.ok(validFormat(format,text).every(m=>m.href==='https://example.com/'));assert.equal(format[0].bold,true);
 format=setLink(text,format,0,12,'https://other.example');assert.ok(format.every(m=>m.href==='https://other.example/'));
 const edited=editFormat(text,'See '+text,format,{start:0,end:0});assert.ok(edited.some(m=>m.href==='https://other.example/'&&m.end===16));
 const days={'2026-10-22':[{id:'link',text,minute:0,done:false,format}]};assert.deepEqual(validState({version:1,days}).days['2026-10-22'][0].format,format);
 const removed=setLink(text,format,0,12,null);assert.ok(removed.every(m=>!m.href));assert.equal(removed[0].bold,true);
 assert.throws(()=>validFormat([{start:0,end:2,href:'javascript:alert(1)'}],text));
});
test('rendered links open safely, avoid invoking note editing, and require a modifier while editing',()=>{
 const original=globalThis.document,children=[];
 globalThis.document={createElement:tag=>({tag,style:{},addEventListener(type,callback){this[type]=callback;}})};
 const element={replaceChildren(){children.length=0;},append(child){children.push(child);}};
 try{
  renderFormatted(element,'Portfolio',[{start:0,end:9,href:'https://example.com',bold:true}]);let link=children[0];assert.equal(link.tag,'a');assert.equal(link.href,'https://example.com/');assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.style.fontWeight,'700');
  let stopped=false,prevented=false;link.click({stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});assert.equal(stopped,true);assert.equal(prevented,false);
  renderFormatted(element,'https://example.com',[],{editable:true});link=children[0];link.click({stopPropagation(){},preventDefault(){prevented=true;}});assert.equal(prevented,true);
 }finally{globalThis.document=original;}
});
