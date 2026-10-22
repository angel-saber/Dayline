import {typeBadge} from './note-types.js?v=note-types-1';
import {musicProfile} from './focus-music.js?v=cyber-mission-12';
import {voice,personality,focusMantras,focusIdeas} from './personality.js?v=intention-labels-3';
import {dayKey,timeLabel,bucket} from './model.js';
import {newFocus,advanceFocus,commitFocus,findFocusNote,validFocusDraft,durationLabel,MANTRAS,INSPIRATION} from './focus-model.js?v=focus-1';
import {FocusAudio} from './focus-audio.js?v=speaker-playback-1';
import {createNoteEditor} from './note-editor.js?v=note-types-1';
import {renderFormatted} from './format.js?v=hyperlinks-1';
import {noteTasks} from './tasks.js?v=line-tasks-1';
const KEY='dayline.focus.v1';
const defaults={binaural:false,ambient:true,warmAmbient:false,metronome:false,beat:10,bpm:80,tonesVolume:30,ambientVolume:35,warmVolume:35,metronomeVolume:50};
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action,className='secondary')=>{const el=node('button',className,text);el.type='button';el.addEventListener('click',action);return el;};
export function setupFocus(api){
  const owner=crypto.randomUUID(),audio=new FocusAudio(),launch=document.querySelector('#launch-focus');
  const dialog=node('dialog','focus-window');dialog.setAttribute('aria-label','Dayline Focus Mode');document.body.append(dialog);
  const mini=button('',()=>open(),'focus-mini');mini.hidden=true;document.body.append(mini);
  let session=null,noteEditor=null,error='',unreadable=false,transition=false,audioSettings={...defaults};
  try{const raw=localStorage.getItem(KEY);if(raw)session=validFocusDraft(JSON.parse(raw));}catch{unreadable=true;}
  function save(claim=false){
    if(!session)return true;
    try{
      const raw=localStorage.getItem(KEY),other=raw&&JSON.parse(raw);
      if(!claim&&other&&other.owner!==owner){error='This session is open in another tab. Resume here to take over.';status();return false;}
      session.owner=owner;session.audio={...audioSettings};localStorage.setItem(KEY,JSON.stringify(session));error='';status();return true;
    }catch{error='Your browser could not save this session draft. Keep this tab open and try saving again.';status();return false;}
  }
  function status(){dialog.querySelector('.focus-save-status')?.replaceChildren(document.createTextNode(error));}
  function buttons(){
    launch.hidden=!!session;launch.textContent=unreadable?'Recover Focus draft':'Launch Focus Mode';
    mini.hidden=!session||dialog.open;
    if(session){const elapsed=session.startedAt?durationLabel((session.endedAt||Date.now())-session.startedAt):'Ready when you are';mini.textContent=`${session.phase==='reflect'?'Finish reflection':'Return to Focus'} · ${elapsed}${audio.playing?' · ♪':''}`;}
  }
  function page(){return session.pages[session.viewIndex];}
  function resolve(p=page()){return findFocusNote(api.getState().days,p.noteId,p.date);}
  function flushNote(){if(noteEditor){noteEditor.flush();noteEditor.destroy();noteEditor=null;}}
  function base(title){
    flushNote();dialog.replaceChildren();const header=node('div','focus-window-header'),heading=node('h1','',title);heading.tabIndex=-1;
    header.append(node('span','eyebrow','DAYLINE · FOCUS MODE'),button('Minimize',minimize,'focus-minimize'));
    dialog.append(header,heading,node('p','focus-save-status',error));dialog.querySelector('.focus-save-status').setAttribute('role','status');
  }
  function minimize(){flushNote();if(session&&session.owner===owner)save();dialog.close();buttons();}
  function refreshPageSnapshot(p=page()){
    const found=resolve(p);if(found){p.title=found.entry.title||'';p.text=found.entry.text;p.noteId=found.entry.id;}
  }
  function editNote(host){
    flushNote();const p=page(),found=resolve(p);
    noteEditor=createNoteEditor({entry:found?.entry,label:'Focus interval note',
      onChange(values){
        const result=api.editNote(found?.date||p.date,p.noteId,p.minute,values);
        if(result){p.noteId=result.id;p.title=values.title;p.text=values.text;save();}
      },onDone(){flushNote();render();},
    });host.replaceChildren(noteEditor.element);noteEditor.focus();
  }
  function noteSection(){
    const p=page(),found=resolve(p),entry=found?.entry;
    const section=node('section','focus-section'),heading=node('div','focus-section-heading');
    heading.append(node('h2','',voice('Intention')),button(entry?'Edit note':'Add a note',()=>editNote(body)));
    section.append(heading,node('p','focus-interval-label',`${p.date} · ${timeLabel(p.minute,api.getState().settings.clock)} – ${timeLabel(Math.min(1440,p.minute+(p.interval||session.interval)),api.getState().settings.clock)}`));
    const body=node('div','focus-note');section.append(body);
    if(entry){
      const badge=typeBadge(entry.noteType);if(badge)body.append(badge);
      if(entry.title)body.append(node('h3','',entry.title));
      let start=0;
      for(const line of entry.text.split('\n')){
        const row=node('div','note-line'),task=noteTasks(entry).find(t=>t.start===start),anchor=start;
        if(task){const check=node('input','line-checkbox');check.type='checkbox';check.checked=task.done;check.setAttribute('aria-label',`Complete focus task: ${line}`);check.addEventListener('change',()=>{api.checkTask(found.date,entry.id,anchor);refreshPageSnapshot();render();});row.append(check);}
        if(!task&&entry.bullets?.some(item=>item.start===start)){const marker=node('span','bullet-marker','•');marker.setAttribute('aria-hidden','true');row.append(marker);}
        const text=node('span','note-text');const marks=(entry.format||[]).filter(m=>m.start<start+line.length&&m.end>start).map(m=>({...m,start:Math.max(0,m.start-start),end:Math.min(line.length,m.end-start)}));renderFormatted(text,line||'\u200b',marks);text.classList.toggle('task-completed',!!task?.done);row.append(text);body.append(row);start+=line.length+1;
      }
      const choices=(api.getState().days[p.date]||[]).filter(e=>bucket(e.minute,p.interval||session.interval)===p.minute);
      if(choices.length>1){const select=node('select');select.setAttribute('aria-label','Choose a note for this interval');for(const item of choices){const option=node('option','',item.title||item.text.split('\n')[0]||'Untitled note');option.value=item.id;select.append(option);}select.value=p.noteId;select.addEventListener('change',()=>{p.noteId=select.value;refreshPageSnapshot();save();render();});section.append(select);}
    }else body.append(node('p','field-hint',p.text?`Earlier note: ${p.title||p.text}`:'No note is planned for this interval yet. You can add one here.'));
    return section;
  }
  function prepare(){
    base(voice("A little commitment. A steady beginning."));const fields=node('div','focus-prep-fields');
    fields.append(node('p','focus-lead',voice("For this interval, you have chosen to focus on:")),noteSection());
    for(const [title,copy] of [
      [voice("Overwhelmed about your tasks?"),voice("Break the task into smaller chunks and write just the next few steps. Ask for help, or consider delegating a task to someone who can take it on. If starting feels hard, try just two minutes of one small action. You can decide what comes next after that.")],
      [voice("Confused about your tasks?"),voice("Clarify the result you are aiming for: what would “done” look like? Work backwards from that result to find your first step. If information is missing, name the question and who you could ask for clarification. Set aside time to research or explore before expecting yourself to have the answer.")],
    ]){const details=node('details','focus-advice');details.append(node('summary','',title),node('p','',copy));fields.append(details);}
    const commitment=node('section','focus-commitment');commitment.append(node('h2','',voice("Choose your commitment")));
    const mantra=node('textarea','focus-mantra-input');mantra.rows=3;mantra.value=session.mantra;mantra.setAttribute('aria-label','Commitment mantra');mantra.addEventListener('input',()=>{mantra.setCustomValidity('');session.mantra=mantra.value;save();});
    const controls=node('div','inline');controls.append(button('Reshuffle mantra',()=>{const pool=focusMantras(MANTRAS);let next=pool[Math.floor(Math.random()*pool.length)];if(next===session.mantra)next=pool[(pool.indexOf(next)+1)%pool.length];session.mantra=next;mantra.value=next;save();}),button('Commit',()=>{
      if(!session.mantra.trim()){mantra.setCustomValidity('Choose or write a mantra first.');mantra.reportValidity();return;}mantra.setCustomValidity('');
      flushNote();commitFocus(session,api.getState(),Date.now());save();transition=true;dialog.classList.add('focus-committing');
      controls.querySelectorAll('button').forEach(b=>b.disabled=true);
      setTimeout(()=>{transition=false;dialog.classList.remove('focus-committing');if(session&&dialog.open)render();},1100);
    },'primary'));
    commitment.append(mantra,node('small','field-hint','Keep this mantra, reshuffle it, or write your own.'),controls);
    fields.append(button('Cancel preparation',()=>{clear();dialog.close();buttons();},'text-button'));dialog.append(fields,commitment);
  }
  function audioSection(){
    const section=node('section','focus-section');section.append(node('h2','','Focus audio'),node('p','field-hint',musicProfile(personality()).description+' Music and warm ambience work through speakers or headphones. Mix any layers you like. Warm ambient sound is the original soft background layer, available with or without music in every layout. Binaural tones use separate left and right channels for headphones. The metronome tempo is independent of the soundtrack.'));
    section.append(node('p','field-hint','Suggested starting points to experiment with (binaural difference · metronome tempo):'));
    const suggestions=node('ul','field-hint focus-audio-presets'),presetButtons=[],tempoControls=new Map();
    for(const [name,copy,beat,bpm] of [
      ['Gentle','Gentle reflection or brainstorming: 6 Hz · 60 BPM.',6,60],
      ['Relaxed','Relaxed, steady writing or reading: 10 Hz · 80 BPM.',10,80],
      ['Brisk','A brisk rhythm for routine tasks: 14 Hz · 100 BPM.',14,100],
    ]){
      const item=node('li'),apply=button('Use '+name.toLowerCase(),()=>{
        audioSettings.beat=beat;audioSettings.bpm=bpm;syncTempos();changeAudio();
      });
      apply.setAttribute('aria-label',`Use ${name.toLowerCase()}: ${beat} Hz and ${bpm} BPM`);
      presetButtons.push({apply,beat,bpm});item.append(node('span','',copy),apply);suggestions.append(item);
    }
    function syncTempos(){
      for(const [key,inputs] of tempoControls)for(const input of inputs)input.value=audioSettings[key];
      for(const {apply,beat,bpm} of presetButtons)apply.setAttribute('aria-pressed',String(audioSettings.beat===beat&&audioSettings.bpm===bpm));
    }
    section.append(suggestions,node('p','field-hint','These are optional listening ideas, not scientifically established recipes for flow. Evidence for binaural brainwave entrainment is mixed; no frequency or BPM guarantees a mental state. Hz is the difference between the two ear tones; BPM controls the separate metronome. Adjust either independently, or turn a layer off.'));
    const action=button(audio.playing?'Pause audio':'Play audio',async()=>{
      action.disabled=true;try{if(audio.playing)await audio.fadeOut();else await audio.play({...audioSettings,layout:personality()});action.textContent=audio.playing?'Pause audio':'Play audio';buttons();}catch(e){error=e.message;status();}finally{action.disabled=false;}
    },'primary');
    for(const [key,label,volume] of [['binaural','Binaural tones','tonesVolume'],['ambient',musicProfile(personality()).label,'ambientVolume'],['warmAmbient','Warm ambient sound','warmVolume'],['metronome','Steady metronome','metronomeVolume']]){
      const row=node('div','focus-audio-row'),toggleLabel=node('label',''),toggle=node('input');toggle.type='checkbox';toggle.checked=audioSettings[key];toggleLabel.append(toggle,document.createTextNode(' '+label));
      toggle.addEventListener('change',()=>{audioSettings[key]=toggle.checked;changeAudio();});
      const range=node('input');range.type='range';range.min=0;range.max=100;range.value=audioSettings[volume];range.setAttribute('aria-label',label+' volume');range.addEventListener('input',()=>{audioSettings[volume]=Number(range.value);changeAudio();});row.append(toggleLabel,range);section.append(row);
    }
    for(const [key,label,min,max] of [['bpm','Metronome tempo (BPM)',30,180],['beat','Binaural frequency difference (Hz)',2,15]]){
      const row=node('div','focus-tempo-control'),labelNode=node('label','',label),range=node('input'),input=node('input');
      range.type='range';input.type='number';input.required=true;range.id='focus-tempo-'+key;labelNode.htmlFor=range.id;
      for(const control of [range,input]){control.min=min;control.max=max;control.step=1;control.value=audioSettings[key];}
      range.setAttribute('aria-label',label+' slider');input.setAttribute('aria-label',label);
      range.setAttribute('aria-describedby','focus-preset-help');input.setAttribute('aria-describedby','focus-preset-help');
      tempoControls.set(key,[range,input]);
      range.addEventListener('input',()=>{audioSettings[key]=Number(range.value);syncTempos();changeAudio();});
      input.addEventListener('change',()=>{if(!input.reportValidity())return;audioSettings[key]=Number(input.value);syncTempos();changeAudio();});
      row.append(labelNode,range,input);section.append(row);
    }
    const help=node('p','field-hint','Presets update both sliders. Fine-tune either value below; layer switches stay as you set them.');help.id='focus-preset-help';section.append(help);syncTempos();
    async function changeAudio(){save();if(audio.playing){try{await audio.play({...audioSettings,layout:personality()});}catch(e){error=e.message;status();}}}
    section.append(action);return section;
  }
  function active(){
    base(voice("Make a little progress."));dialog.append(node('p','focus-mantra',session.mantra));
    const stats=node('div','focus-stats');stats.append(node('span','focus-elapsed'),node('span','focus-live-position'));dialog.append(stats);
    const pages=node('div','focus-page-nav');const previous=button('← Previous interval',()=>{flushNote();session.viewIndex--;save();render();}),next=button('Next interval →',()=>{flushNote();session.viewIndex++;save();render();});previous.disabled=session.viewIndex===0;next.disabled=session.viewIndex===session.pages.length-1;
    pages.append(previous,node('span','',`${session.viewIndex+1} / ${session.pages.length}`),next);
    if(session.viewIndex!==session.pages.length-1)pages.append(button('Return to current interval',()=>{flushNote();session.viewIndex=session.pages.length-1;save();render();}));dialog.append(pages,noteSection());
    const found=resolve(),current=session.pages.at(-1);
    if(session.viewIndex<session.pages.length-1&&found&&!found.entry.done&&current.noteId!==page().noteId){
      const extend=node('div','focus-extend');extend.append(node('p','field-hint','Continue this unfinished note in the current interval. That interval’s existing notes move together to the next empty slot.'),button('Continue this note in current interval',()=>{
        flushNote();if(api.extendNote(page().noteId,page().date,current.date,current.minute,session.interval)){
          current.noteId=page().noteId;session.viewIndex=session.pages.length-1;refreshPageSnapshot();save();render();
        }
      }));dialog.append(extend);
    }
    dialog.append(audioSection());const inspiration=node('section','focus-section');inspiration.append(node('h2','',voice("Inspiration pocket")),node('p','focus-inspiration'),node('small','field-hint',voice("A new encouraging line every 10 minutes.")));dialog.append(inspiration);
    const interruptions=node('section','focus-section');interruptions.append(node('h2','','Interruption log'),node('p','field-hint',voice("Put distractions, reminders, questions, or passing thoughts here. This interval has its own page.")));
    const log=node('textarea','focus-log-input');log.rows=5;log.placeholder=voice("Set it down here, then return to your work…");log.value=page().log;log.setAttribute('aria-label','Interruption log for '+page().date+' '+timeLabel(page().minute));const p=page();log.addEventListener('input',()=>{p.log=log.value;save();});interruptions.append(log);dialog.append(interruptions,button('Finish session',finish,'primary focus-finish'));tickLabels();
  }
  function finish(){
    flushNote();advanceFocus(session,api.getState(),Date.now());session.endedAt=Math.max(session.startedAt,Date.now());session.phase='reflect';save();audio.fadeOut().then(buttons);render();
  }
  function reflect(){
    base(voice("A gentle look back."));dialog.append(node('p','focus-mantra',session.mantra),node('p','focus-lead',`${durationLabel(session.endedAt-session.startedAt)} ${voice("of showing up. Your reflection is optional.")}`));
    for(const [key,label] of [['progress','What moved forward?'],['learned','What did you learn, if anything?'],['next','Where will you pick up next?']]){
      const field=node('label','focus-reflection-label',label),input=node('textarea');input.rows=3;input.value=session.reflection[key];input.setAttribute('aria-label',label);input.addEventListener('input',()=>{session.reflection[key]=input.value;save();});field.append(input);dialog.append(field);
    }
    const controls=node('div','inline');const saveButton=button('Save reflection & close',()=>complete(false),'primary'),skip=button('Skip reflection & close',()=>complete(true));
    function complete(skipReflection){
      if(skipReflection)session.reflection={progress:'',learned:'',next:''};save();
      if(api.saveReport(session)){clear();dialog.close();buttons();api.refresh();api.toast('Focus session saved inside its interval note.');}
      else{error='Your session could not be saved. Your draft is kept here so you can try again.';status();}
    }
    controls.append(saveButton,skip);dialog.append(controls);
  }
  function render(){if(!session)return;refreshPageSnapshot();if(session.phase==='prepare')prepare();else if(session.phase==='reflect')reflect();else active();buttons();}
  function clear(){flushNote();audio.stop();if(session?.owner===owner){try{const draft=JSON.parse(localStorage.getItem(KEY)||'null');if(draft?.owner===owner)localStorage.removeItem(KEY);}catch{}}session=null;transition=false;dialog.classList.remove('focus-committing');}
  function recover(){
    dialog.replaceChildren(node('h1','','Recover your Focus draft'),node('p','','This draft could not be read. Download it before starting fresh.'));
    dialog.append(button('Download draft',()=>{const raw=localStorage.getItem(KEY)||'';const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=node('a');a.href=url;a.download='dayline-focus-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),button('Discard draft and start fresh',()=>{localStorage.removeItem(KEY);unreadable=false;dialog.close();start();}),button('Close',()=>dialog.close()));dialog.showModal();
  }
  function start(){
    if(unreadable){recover();return;}
    api.flushEditor();
    try{const raw=localStorage.getItem(KEY);if(raw)session=validFocusDraft(JSON.parse(raw));}catch{unreadable=true;recover();return;}
    if(!session){session=newFocus(api.getState(),Date.now(),crypto.randomUUID(),owner);session.mantra=focusMantras(MANTRAS)[0];}open();
  }
  function open(){
    if(!session)return;api.flushEditor();session.owner=owner;
    if(session.audio)for(const key of Object.keys(defaults)){const value=session.audio[key];if(typeof defaults[key]==='boolean'&&typeof value==='boolean')audioSettings[key]=value;else if(Number.isFinite(value))audioSettings[key]=Math.min(key==='bpm'?180:key==='beat'?15:100,Math.max(key==='bpm'?30:key==='beat'?2:0,value));}
    advanceFocus(session,api.getState(),Date.now());save(true);render();if(!dialog.open)dialog.showModal();dialog.scrollTop=0;buttons();
  }
  launch.addEventListener('click',start);dialog.addEventListener('cancel',event=>{event.preventDefault();minimize();});dialog.addEventListener('close',buttons);
  // Only a gesture that starts and ends on the backdrop minimizes the session.
  // Selecting text or dragging a control out of the window must not dismiss it.
  let backdropPress=false;
  function onBackdrop(event){
    const rect=dialog.getBoundingClientRect();
    return event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);
  }
  dialog.addEventListener('pointerdown',event=>{backdropPress=event.isPrimary&&event.button===0&&onBackdrop(event);});
  dialog.addEventListener('pointercancel',()=>{backdropPress=false;});
  dialog.addEventListener('click',event=>{const dismiss=backdropPress&&onBackdrop(event);backdropPress=false;if(dismiss)minimize();});
  function tickLabels(){
    if(!session)return;
    const elapsed=Math.max(0,(session.endedAt||Date.now())-(session.startedAt||Date.now()));
    const elapsedNode=dialog.querySelector('.focus-elapsed');if(elapsedNode)elapsedNode.textContent='Session · '+durationLabel(elapsed);
    const position=dialog.querySelector('.focus-live-position');if(position)position.textContent=session.viewIndex===session.pages.length-1?'Current interval':'Reviewing an earlier interval';
    const idea=dialog.querySelector('.focus-inspiration');if(idea)idea.textContent=focusIdeas(INSPIRATION)[(session.seed+Math.floor(elapsed/600000))%focusIdeas(INSPIRATION).length];buttons();
  }
  function tick(){
    if(!session)return;
    if(session.owner===owner&&session.phase!=='reflect'){
      const slot=api.getState(),last=session.pages.at(-1).key;
      // Flush an open note before changing its interval page.
      const now=new Date(),key=`${dayKey(now)}:${bucket(now.getHours()*60+now.getMinutes(),slot.settings.interval)}:${slot.settings.interval}`;
      if(last!==key){flushNote();if(advanceFocus(session,slot,Date.now())){save();if(dialog.open&&!transition)render();}}
    }
    tickLabels();
  }
  setInterval(tick,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.addEventListener('pagehide',()=>{flushNote();if(session?.owner===owner)save();audio.stop();});
  window.addEventListener('storage',event=>{
    if(event.key!==KEY)return;
    try{
      const incoming=event.newValue?validFocusDraft(JSON.parse(event.newValue)):null;
      if(incoming?.owner===owner)return;
      flushNote();audio.stop();session=incoming;dialog.close();buttons();
    }catch{error='A focus draft from another tab could not be read.';status();}
  });
  window.addEventListener('dayline:appearance',()=>{if(audio.playing)audio.play({...audioSettings,layout:personality()}).catch(e=>{error=e.message;status();});if(session&&dialog.open&&!transition)render();});
  buttons();return {refresh:buttons,minimize};
}
