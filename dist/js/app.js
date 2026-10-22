import {dayKey,parseDay,offsetDay,slots,grouped,moveEntry,timeLabel} from './model.js';
import {load,save,validState} from './storage.js?v=line-tasks-1';
import {attachGestures} from './gestures.js';
import {Reminders} from './reminders.js';
import {setupAccounts} from './accounts.js?v=line-tasks-1';
import {dailyQuote} from './quotes.js';
import {renderFormatted} from './format.js?v=direct-edit-1';
import {createNoteEditor} from './note-editor.js?v=continue-format-1';
import {noteTasks} from './tasks.js?v=line-tasks-1';
const $=s=>document.querySelector(s);
let state,readFailed=false,selected=dayKey(),view='daily',undo=null,editor=null,moveId=null,pendingImport=null,accounts=null;
try{state=load();}catch{readFailed=true;state={version:1,days:{},settings:{interval:60,clock:'12',notifications:false,sound:false}};}
const announce=text=>{$('#announcer').textContent=text;};
function toast(text,withUndo=false){$('#toast-text').textContent=text;$('#undo').hidden=!withUndo;$('#toast').hidden=false;announce(text);}
function persist(){
  if(readFailed){$('#save-status').textContent='● Saving paused';toast('Stored data could not be read. Export a recovery copy or restore a valid backup before saving.');return false;}
  try{if(accounts)accounts.persist(state);else save(state);if(!accounts?.isSignedIn())$('#save-status').textContent='● Saved on this device';return true;}
  catch{$('#save-status').textContent='● Not saved';toast('Your browser could not save this change. Download a backup in Settings to keep your notes.');return false;}
}
function entries(){return state.days[selected]||[];}
function commit(next,message){
  undo={date:selected,entries:structuredClone(entries())};state.days[selected]=next;persist();renderTimeline();toast(message,true);
}
function complete(id){const e=entries().find(e=>e.id===id);if(e)commit(entries().map(e=>e.id===id?{...e,done:!e.done}:e),e.done?'Note reopened':'A little progress. Note completed.');}
function remove(id){commit(entries().filter(e=>e.id!==id),'Note deleted');}
function move(id,minute){commit(moveEntry(entries(),id,minute,state.settings.interval),`Note moved to ${timeLabel(minute,state.settings.clock)}`);}
const reminders=new Reminders(()=>accounts?.isLoginVisible()?{...state,settings:{...state.settings,notifications:false}}:state,e=>toast(`It’s time · ${e.text}`),toast);
document.addEventListener('pointerdown',()=>{if(state.settings.sound)reminders.unlockAudio().catch(()=>{});},{once:true});
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function button(text,label,fn,className=''){const b=node('button',className,text);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b;}
function renderHeader(){
  renderDailyQuote();
  const d=parseDay(selected),today=dayKey(),isToday=selected===today;
  $('#relative-day').textContent=isToday?'YOUR DAY, AT YOUR PACE':selected===offsetDay(today,-1)?'A LITTLE LOOK BACK':selected===offsetDay(today,1)?'A LITTLE LOOK AHEAD':'ONE DAY AT A TIME';
  $('#day-heading').textContent=`${d.toLocaleDateString(undefined,{weekday:'long'})}, `;
  $('#day-heading').append(node('span','date-number',d.toLocaleDateString(undefined,{month:'short',day:'numeric'})));
  $('#footer-date').textContent=d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  $('#date-picker').value=selected;
  $('#previous-label').textContent=isToday?'Yesterday':'Previous day';$('#next-label').textContent=isToday?'Tomorrow':'Next day';
  $('#interval-shortcut').firstChild.textContent=`${state.settings.interval%60===0?`${state.settings.interval/60}-hour`:`${state.settings.interval}-minute`} intervals `;
  $('#jump-now').hidden=!isToday;
}
function renderDailyQuote(){
  const quote=dailyQuote();
  if($('#daily-quote').textContent!==quote)$('#daily-quote').textContent=quote;
}
function renderSummary(){
  const list=entries(),done=list.filter(e=>e.done).length;
  $('#summary').textContent=list.length?`${done} of ${list.length} ${list.length===1?'note':'notes'} completed`:'A fresh page for your day';
  $('#progress').style.width=`${list.length?done/list.length*100:0}%`;
}
function renderTimeline(){
  editor?.destroy();editor=null;renderHeader();renderSummary();
  const now=new Date(),minuteNow=now.getHours()*60+now.getMinutes(),isToday=selected===dayKey(),fragment=document.createDocumentFragment();
  for(const slot of grouped(entries(),state.settings.interval)){
    const row=node('section','slot');row.dataset.minute=slot.minute;row.setAttribute('aria-label',timeLabel(slot.minute,state.settings.clock));
    const time=node('div','slot-time',timeLabel(slot.minute,state.settings.clock));
    time.append(node('span','end-time',`– ${timeLabel(Math.min(1440,slot.minute+state.settings.interval),state.settings.clock)}`));
    if(isToday&&slot.minute<=minuteNow&&minuteNow<slot.minute+state.settings.interval){row.classList.add('current');time.append(node('span','now-badge','NOW'));}
    const notes=node('div','slot-notes');
    for(const e of slot.entries){
      const card=node('article',`entry${e.done?' done':''}`);card.dataset.id=e.id;
      const content=node('div','note-content');
      renderNoteLines(content,e.text,e.format,noteTasks(e),start=>{
        const tasks=noteTasks(e).map(t=>t.start===start?{...t,done:!t.done}:t);
        commit(entries().map(item=>item.id===e.id?{...item,tasks,task:false}:item),'Task updated');
      },()=>openEditor(notes,slot.minute,e));card.append(content);
      const tools=node('div','entry-tools');
      tools.append(button('↗','Move note to a different time',()=>openMove(e.id),'move-note'),button('×','Delete note',()=>remove(e.id),'delete-note'));
      const handle=node('span','drag-handle','⠿');handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label','Hold and drag to move, or press Enter to choose a time');
      handle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openMove(e.id);}});tools.append(handle);card.append(tools);notes.append(card);
    }
    if(!slot.entries.length)notes.append(button('','Add a note at '+timeLabel(slot.minute,state.settings.clock),()=>openEditor(notes,slot.minute),'empty-add'));
    row.append(time,notes);fragment.append(row);
  }
  $('#timeline').replaceChildren(fragment);
  // Keep most empty rows quiet; the current/first visible invitation explains the action.
  const invitation=$('#timeline .current .empty-add')||$('#timeline .empty-add');
  if(invitation){invitation.append(node('span','','+'),document.createTextNode('What would you like to make time for?'));}
}
// Render line controls beside text; never nest a checkbox inside an edit button.
function renderNoteLines(container,text,format=[],tasks=[],onCheck,onEdit){
  container.replaceChildren();let start=0;
  for(const line of text.split('\n')){
    const row=node('div','note-line'),task=tasks.find(t=>t.start===start),anchor=start;
    if(task){
      const check=node('input','line-checkbox');check.type='checkbox';check.checked=task.done;
      check.setAttribute('aria-label',`Complete task: ${line||'Empty line'}`);
      check.addEventListener('change',()=>onCheck(anchor));row.append(check);
    }
    const textNode=onEdit?button('',`Edit note: ${line||'Empty line'}`,onEdit,'note-text'):node('span','note-text');
    const marks=format.filter(m=>m.start<start+line.length&&m.end>start).map(m=>({...m,start:Math.max(0,m.start-start),end:Math.min(line.length,m.end-start)}));
    renderFormatted(textNode,line,marks);if(!line)textNode.append(document.createTextNode('\u200b'));
    textNode.classList.toggle('task-completed',!!task?.done);row.append(textNode);container.append(row);
    start+=line.length+1;
  }
}
function openEditor(container,minute,entry){
  if(editor){flushEditor();renderTimeline();container=$(`#timeline .slot[data-minute="${minute}"] .slot-notes`);}
  let id=entry?.id;const date=selected;
  const noteEditor=createNoteEditor({
    entry,label:'Note for '+timeLabel(minute,state.settings.clock),
    onChange({text,format,tasks}){
      const list=state.days[date]||[];undo=null;$('#undo').hidden=true;
      if(!text.trim()){if(id)state.days[date]=list.filter(e=>e.id!==id);}
      else if(id&&list.some(e=>e.id===id)){state.days[date]=list.map(e=>e.id===id?{...e,text,format,tasks,task:false}:e);}
      else{id=crypto.randomUUID();state.days[date]=[...list,{id,text,minute,done:false,format,tasks,task:false}].sort((a,b)=>a.minute-b.minute);}
      persist();renderSummary();
    },
    onDone:renderTimeline,
  });
  container.querySelector('.empty-add')?.remove();
  if(entry)container.querySelector(`[data-id="${CSS.escape(entry.id)}"]`)?.replaceWith(noteEditor.element);else container.append(noteEditor.element);
  editor={sync:noteEditor.flush,destroy:noteEditor.destroy};noteEditor.focus();
}
function flushEditor(){if(editor){editor.sync();editor.destroy();editor=null;}}
function openMove(id){
  flushEditor();renderTimeline();moveId=id;const e=entries().find(e=>e.id===id);if(!e)return;
  $('#move-time').replaceChildren(...slots(state.settings.interval).map(m=>{const o=node('option','',timeLabel(m,state.settings.clock));o.value=m;return o;}));
  $('#move-time').value=Math.floor(e.minute/state.settings.interval)*state.settings.interval;$('#move-dialog').showModal();
}
$('#move-dialog').addEventListener('close',()=>{if($('#move-dialog').returnValue==='move')move(moveId,Number($('#move-time').value));});
attachGestures($('#timeline'),{complete,remove,move,announce});
function navigate(date){flushEditor();selected=date;renderTimeline();window.scrollTo({top:0});}
$('#previous-day').onclick=()=>navigate(offsetDay(selected,-1));$('#next-day').onclick=()=>navigate(offsetDay(selected,1));
$('#today-top').onclick=()=>{navigate(dayKey());jumpNow();};
$('#date-picker').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))navigate(e.target.value);};
function jumpNow(){const row=$('#timeline .current');row?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
$('#jump-now').onclick=jumpNow;
function switchView(next){flushEditor();view=next;$('#daily-view').hidden=next!=='daily';$('#settings-view').hidden=next!=='settings';$('#date-footer').hidden=next!=='daily'||accounts?.isLoginVisible();for(const v of ['daily','settings']){$(`#${v}-tab`).classList.toggle('active',v===next);$(`#${v}-tab`).setAttribute('aria-selected',v===next);}if(next==='settings')renderSettings();else renderTimeline();accounts?.refreshView();window.scrollTo({top:0});}
$('#daily-tab').onclick=()=>switchView('daily');$('#settings-tab').onclick=()=>switchView('settings');$('#interval-shortcut').onclick=()=>switchView('settings');
function renderSettings(){const s=state.settings,isPreset=[15,30,60,120,240].includes(s.interval);$('#interval').value=isPreset?s.interval:'custom';$('#custom-field').hidden=isPreset;$('#custom-minutes').value=s.interval;$('#clock').value=s.clock;$('#notifications').checked=s.notifications;$('#sound').checked=s.sound;notificationStatus();}
function notificationStatus(){let status='Keep Dayline open for reminders. Closed-app alerts aren’t supported in this version. Device settings may silence sound.';if(!globalThis.Notification)status+=' System notifications are unavailable here; in-app reminders still work.';else if(Notification.permission==='denied')status+=' System notifications are blocked in browser settings; in-app reminders still work.';$('#notification-status').textContent=status;}
function setIntervalLength(value){if(!Number.isInteger(value)||value<1||value>1440){toast('Choose a whole number from 1 to 1440 minutes.');return;}state.settings.interval=value;undo=null;persist();renderSettings();toast('Timeline updated. All your notes are kept.');}
$('#interval').onchange=e=>{if(e.target.value==='custom'){$('#custom-field').hidden=false;$('#custom-minutes').focus();}else setIntervalLength(Number(e.target.value));};
$('#apply-custom').onclick=()=>setIntervalLength(Number($('#custom-minutes').value));
$('#clock').onchange=e=>{state.settings.clock=e.target.value;persist();};
$('#notifications').onchange=async e=>{
  state.settings.notifications=e.target.checked;persist();
  if(e.target.checked&&globalThis.Notification?.permission==='default'){try{await Notification.requestPermission();}catch{toast('System notification permission is unavailable. In-app reminders are enabled.');}}
  notificationStatus();
};
$('#sound').onchange=async e=>{state.settings.sound=e.target.checked;if(e.target.checked){try{await reminders.chime();}catch(error){state.settings.sound=false;toast(error.message);}}persist();renderSettings();};
$('#test-sound').onclick=()=>reminders.chime().then(()=>toast('Sound is ready for this session.')).catch(e=>toast(e.message));
$('#undo').onclick=()=>{if(!undo)return;state.days[undo.date]=undo.entries;const date=undo.date;undo=null;persist();if(selected===date)renderTimeline();toast('Change undone.');};
$('#dismiss-toast').onclick=()=>{$('#toast').hidden=true;};
$('#export').onclick=()=>{
  let data=JSON.stringify(state,null,2);if(readFailed){try{data=localStorage.getItem('dayline.v1')||data;}catch{}}
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=node('a');a.href=url;a.download=`dayline-backup-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>10*1024*1024)throw new Error('Choose a backup under 10 MB.');pendingImport=validState(JSON.parse(await file.text()));$('#restore-dialog').showModal();}
  catch(error){toast(`Could not restore: ${error.message}`);}e.target.value='';
};
$('#restore-dialog').addEventListener('close',()=>{
  if($('#restore-dialog').returnValue==='restore'&&pendingImport){
    // Permission and audio must be enabled deliberately on each new device.
    pendingImport.settings.notifications=false;pendingImport.settings.sound=false;
    try{if(accounts)accounts.persist(pendingImport);else save(pendingImport);state=pendingImport;readFailed=false;undo=null;renderSettings();toast('Backup restored. Enable reminders again when you’re ready.');}
    catch{toast('Your browser could not save the backup. Existing data was kept.');}
  }pendingImport=null;
});
window.addEventListener('pagehide',flushEditor);
window.addEventListener('storage',event=>{if(event.key==='dayline.v1'&&!accounts?.isSignedIn()){try{state=load();readFailed=false;undo=null;if(!editor){if(view==='daily')renderTimeline();else renderSettings();}toast('Notes updated from another tab.');}catch{toast('Another tab saved data that could not be read.');}}});
setInterval(()=>{renderDailyQuote();if(view==='daily'&&!editor){const current=$('#timeline .current'),now=new Date(),minute=now.getHours()*60+now.getMinutes();if(selected===dayKey()&&Number(current?.dataset.minute)!==Math.floor(minute/state.settings.interval)*state.settings.interval)renderTimeline();}},30000);
window.addEventListener('focus',renderDailyQuote);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderDailyQuote();});
renderTimeline();
accounts=setupAccounts({
  getState:()=>state, flushEditor, toast,
  setState(next,options={}){
    const changed=JSON.stringify(state.days[selected]||[])!==JSON.stringify(next.days[selected]||[]);
    state=next;readFailed=options.readFailed??readFailed;
    if(changed){undo=null;editor=null;renderTimeline();}
    else if(!editor&&view==='daily')renderTimeline();
    if(view==='settings')renderSettings();
    $('#restore-explanation').textContent=accounts?.isSignedIn()?'This replaces this account’s notes across devices. Download a backup first if you want to keep them.':'This replaces all notes and settings on this device. Download your current backup first if you want to keep it.';
  },
  onStatus(status,error){
    const labels={local:'● Saved on this device',pending:'● Saved here · waiting to sync',syncing:'● Syncing your notes…',synced:'● Synced across devices',error:'● Not synced · saved here'};
    $('#save-status').textContent=labels[status]||labels.error;
    $('#account-sync-status').textContent=error?.message||labels[status]||'';
  },
});
if(readFailed)toast('Stored data could not be read. Saving is paused to protect it. Open Settings to export a recovery copy or restore a backup.');
