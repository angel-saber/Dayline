import {parseDay,timeLabel} from './model.js';
import {noteTasks} from './tasks.js?v=line-tasks-1';
import {categoryLabel} from './note-types.js?v=bulk-notes-1';
import {safeLink} from './links.js?v=hyperlinks-1';
import {durationLabel} from './focus-model.js?v=focus-1';
import {dimensions,compassTitle,compassDates} from './activities-model.js?v=activities-2';
import {activityCatalog,activityFields} from './activity-catalog.js?v=activities-2';
export const SHARE_DEFAULTS={dateTime:true,type:true,focusReports:false,guidedReports:false};
function linkedLine(text,start,format=[]){
  const end=start+text.length,links=[];
  for(const mark of format.filter(m=>m.href&&m.start<end&&m.end>start).sort((a,b)=>a.start-b.start)){
    const href=safeLink(mark.href);if(!href)continue;
    const a=Math.max(start,mark.start),b=Math.min(end,mark.end),last=links.at(-1);
    if(last&&last.href===href&&a<=last.end)last.end=Math.max(last.end,b);else links.push({start:a,end:b,href});
  }
  let result='',at=0;
  for(const link of links){const a=link.start-start,b=link.end-start;if(a<at)continue;const label=text.slice(a,b);result+=text.slice(at,a)+label+(safeLink(label)===link.href?'':` (${link.href})`);at=b;}
  return result+text.slice(at);
}
export function shareNoteText(entry,date,options={},clock='12'){
  const settings={...SHARE_DEFAULTS,...options},parts=[entry.title?.trim()||'Dayline note'];
  if(settings.dateTime)parts.push(`${parseDay(date).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${timeLabel(entry.minute,clock)}`);
  if(settings.type&&categoryLabel(entry.noteType))parts.push(categoryLabel(entry.noteType));
  const tasks=noteTasks(entry);let start=0;
  const body=entry.text.split('\n').map(line=>{const task=tasks.find(t=>t.start===start),bullet=entry.bullets?.some(b=>b.start===start),text=linkedLine(line,start,entry.format);start+=line.length+1;return `${task?(task.done?'☑ ':'☐ '):bullet?'• ':''}${text}`;}).join('\n');
  if(body.trim())parts.push('',body);
  if(settings.focusReports)for(const report of entry.focusReports||[]){
    parts.push('',`Focus session · ${new Date(report.startedAt).toLocaleString()} · ${durationLabel(report.durationMs)}`,`My commitment: ${report.mantra}`);
    const logs=report.logs.filter(l=>l.text.trim()).map(l=>`${l.date} · ${timeLabel(l.minute,clock)}\n${l.text}`).join('\n\n');parts.push('Interruption log:',logs||'No interruptions recorded.');
    for(const [key,label] of [['progress','What moved forward'],['learned','What I learned'],['next','Where I will pick up next']])if(report.reflection[key])parts.push(`${label}: ${report.reflection[key]}`);
  }
  if(settings.guidedReports)for(const report of entry.guidedActivities||[]){
    const title=report.activity?activityCatalog[report.activity].title:'Guided Planning';parts.push('',`Guided activity · ${title} · ${new Date(report.completedAt).toLocaleString()}`);
    for(const field of report.activity?activityFields(report.activity):dimensions.map(d=>({key:d.key,label:d.label})))if(report.answers[field.key])parts.push(`${field.label}: ${report.answers[field.key]}`);
    if(report.timer)parts.push(report.timer.completed?'Two-minute timer completed.':`Action timer: ${Math.floor(report.timer.elapsedMs/1000)} seconds.`);
    if(report.schedule)parts.push(`${compassTitle(report.schedule.date)}\nWeekly notes: ${compassDates(report.schedule.date).join(', ')} at ${report.schedule.time}`);
  }
  parts.push('','Planned with Dayline');return parts.join('\n');
}
export function shareNotesText(items,options={},clock='12',heading='Dayline plan'){
 const settings={...SHARE_DEFAULTS,...options},parts=[heading.trim()||'Dayline plan'];let previousDate=null;
 for(const {date,entry} of [...items].sort((a,b)=>a.date.localeCompare(b.date)||a.entry.minute-b.entry.minute)){
  if(settings.dateTime&&date!==previousDate){parts.push('',parseDay(date).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'}));previousDate=date;}
  const text=shareNoteText(entry,date,{...settings,dateTime:false},clock).split('\n').slice(1,-2).join('\n');
  parts.push('',`${settings.dateTime?timeLabel(entry.minute,clock)+' — ':''}${entry.title?.trim()||'Dayline note'}`);if(text.trim())parts.push(text);
 }
 parts.push('','Planned with Dayline');return parts.join('\n');
}
export function openShareNote(entry,date,clock='12'){return openShareItems([{entry,date}],clock,false);}
export function openShareNotes(items,clock='12'){if(items.length)return openShareItems(items,clock,true);}
export function emailNoteUrl(title,text){return `mailto:?subject=${encodeURIComponent(title?.trim()||'Dayline note')}&body=${encodeURIComponent(text)}`;}
function openShareItems(items,clock,multiple){
  const {entry,date}=items[0];
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const dialog=node('dialog','share-note-dialog'),heading=node('h2','','Share note');heading.id='share-note-heading';dialog.setAttribute('aria-labelledby',heading.id);
  const intro=node('p','field-hint','Share a clean text copy. Recipients do not need a Dayline account. Choose what to include below.');
  const options={...SHARE_DEFAULTS},choices=node('fieldset','share-note-options');choices.append(node('legend','','Include in shared text'));
  const preview=node('textarea','share-note-preview');preview.readOnly=true;preview.rows=12;preview.setAttribute('aria-label','Shared note preview');
  const status=node('p','field-hint');status.setAttribute('role','status');
  const email=node('a','secondary','Email'),titleInput=node('input');titleInput.type='text';titleInput.maxLength=200;titleInput.value='Dayline plan';titleInput.setAttribute('aria-label','Shared plan heading');
  const shareTitle=()=>multiple?(titleInput.value.trim()||'Dayline plan'):(entry.title?.trim()||'Dayline note');
  function refresh(){preview.value=multiple?shareNotesText(items,options,clock,shareTitle()):shareNoteText(entry,date,options,clock);email.href=emailNoteUrl(shareTitle(),preview.value);status.textContent='';}
  for(const [key,label,available] of [['dateTime','Date and time',true],['type','Note type',items.some(item=>!!item.entry.noteType)],['focusReports','Focus reports, including reflections and interruption logs',items.some(item=>!!item.entry.focusReports?.length)],['guidedReports','Guided activity reports',items.some(item=>!!item.entry.guidedActivities?.length)]]){
    const wrapper=node('label',''),check=node('input');check.type='checkbox';check.checked=available&&options[key];check.disabled=!available;check.addEventListener('change',()=>{options[key]=check.checked;refresh();});wrapper.append(check,document.createTextNode(label));choices.append(wrapper);
  }
  const actions=node('div','inline');const action=(text,fn,cls='secondary')=>{const button=node('button',cls,text);button.type='button';button.onclick=fn;return button;};
  const share=action('Share…',async()=>{try{await navigator.share({title:shareTitle(),text:preview.value});status.textContent='Shared.';}catch(error){status.textContent=error.name==='AbortError'?'Sharing cancelled.':'Sharing is unavailable here. Use Copy text or Email instead.';}},'primary');
  share.disabled=typeof navigator.share!=='function';
  const copy=action('Copy text',async()=>{try{await navigator.clipboard.writeText(preview.value);status.textContent='Copied to clipboard.';}catch{preview.focus();preview.select();status.textContent='Copy the selected preview using your device’s Copy command.';}});
  actions.append(share,copy,email,action('Close',()=>dialog.close()));
  dialog.append(heading,intro);if(multiple){const label=node('label','share-preview-label','Heading (optional)');label.append(titleInput);dialog.append(label);titleInput.oninput=refresh;}
  dialog.append(choices,node('label','share-preview-label','Preview'),preview,actions,status);
  if(share.disabled)dialog.append(node('p','field-hint','Your browser does not offer a sharing menu. Copy text and Email are available.'));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const onAccount=()=>dialog.close();window.addEventListener('dayline:account',onAccount,{once:true});dialog.addEventListener('close',()=>window.removeEventListener('dayline:account',onAccount),{once:true});
  document.body.append(dialog);refresh();dialog.showModal();
}
