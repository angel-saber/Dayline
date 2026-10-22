import {dimensions,breathingFrame} from './activities-model.js?v=activities-1';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='secondary')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
export function renderGuidedReports(container,reports=[]){
  for(const report of reports){const details=el('details','focus-report guided-report');details.append(el('summary','',`Guided activity · Guided Planning · ${new Date(report.completedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`));for(const d of dimensions)details.append(el('h4','',d.label),el('p','',report.answers[d.key]));container.append(details);}
}
export function setupActivities({root,savePlan,onSaved}){
  const dialog=el('dialog','activity-dialog');dialog.setAttribute('aria-labelledby','activity-heading');document.body.append(dialog);
  let answers={},step=0,reportId=null,frame=null,started=0,mode='calm',pausedAt=null,pauseStarted=null;
  function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
  dialog.addEventListener('close',stop);
  window.addEventListener('dayline:account',()=>{stop();dialog.close();answers={};step=0;reportId=null;});
  function shell(title){stop();dialog.replaceChildren();const header=el('div','activity-header'),heading=el('h2','',title);heading.id='activity-heading';heading.tabIndex=-1;queueMicrotask(()=>{if(dialog.open)heading.focus();});header.append(heading,button('Close',()=>dialog.close()));dialog.append(header);}
  function open(){if(!dialog.open)dialog.showModal();}
  function breathe(){
    shell('Guided Breathing');dialog.append(el('p','', 'Choose a two-minute rhythm. Breathe comfortably, without holding your breath or forcing it. You can stop at any time.'));
    const options=el('div','activity-options');options.append(button('Calm · 4 seconds in, 6 out',()=>runBreathing('calm'),'primary'),button('Energize · 3 seconds in, 3 out',()=>runBreathing('energize')));dialog.append(options,el('p','field-hint','For the energizing rhythm, sit upright and let your attention wake up gently. If you feel dizzy or uncomfortable, stop and return to your natural breathing.'));open();
  }
  function runBreathing(choice){
    mode=choice;shell(choice==='calm'?'A calmer rhythm':'A fresh start');started=performance.now();pausedAt=null;
    const graphic=el('div','breath-graphic'),orb=el('div','breath-orb');graphic.setAttribute('aria-hidden','true');graphic.append(orb);
    const instruction=el('p','breath-instruction'),timer=el('p','breath-timer'),status=el('p','sr-only');status.setAttribute('role','status');
    const pause=button('Pause',()=>{if(pausedAt===null){pausedAt=performance.now();pauseStarted=pausedAt;pause.textContent='Resume';}else{started+=performance.now()-pauseStarted;pausedAt=null;pause.textContent='Pause';}});
    dialog.append(graphic,instruction,timer,status,pause,button('Choose another rhythm',breathe));
    let previous='';function tick(){const state=breathingFrame((pausedAt??performance.now())-started,mode);instruction.textContent=state.instruction;timer.textContent=`${Math.floor(state.remaining/60)}:${String(state.remaining%60).padStart(2,'0')} remaining`;orb.style.setProperty('--breath-scale',String(.65+state.expansion*.35));if(state.instruction!==previous){status.textContent=state.instruction;previous=state.instruction;}if(state.done){pause.remove();dialog.append(el('p','', 'Two minutes complete. Notice how you feel, then choose one small next step.'),button('Done',()=>dialog.close(),'primary'));return;}frame=requestAnimationFrame(tick);}tick();
  }
  function plan(){
    shell('Guided Planning');const d=dimensions[step];dialog.append(el('p','field-hint',`Step ${step+1} of 5 · ${d.label}`),el('p','', 'One small activity is enough. These are possibilities for today, not a test or a list you must finish.'));
    const label=el('label','planning-question',d.question),input=el('textarea','planning-answer');input.id='activity-answer';input.maxLength=2000;input.rows=4;input.value=answers[d.key]||'';label.htmlFor=input.id;
    const error=el('p','activity-error');error.setAttribute('role','alert');input.oninput=()=>{answers[d.key]=input.value;error.textContent='';};
    dialog.append(label,el('p','field-hint',d.hint),input,error);
    const controls=el('div','inline');if(step)controls.append(button('Back',()=>{step--;plan();}));controls.append(button(step===4?'Review my plan':'Next',()=>{if(!input.value.trim()){error.textContent='Write one small activity to continue.';input.focus();return;}answers[d.key]=input.value.trim();step++;if(step===5)review();else plan();},'primary'));dialog.append(controls,el('p','field-hint','Your answers stay here while this page is open. They are saved to your notes when you finish.'));open();input.focus();
  }
  function review(){
    shell('Five small ways forward');for(const d of dimensions)dialog.append(el('h3','',d.label),el('p','activity-answer-preview',answers[d.key]));
    const status=el('p','field-hint','Save this as an expandable guided activity in today’s current time interval. Your existing note stays intact.');status.setAttribute('role','status');
    const controls=el('div','inline'),save=button('Save to current interval',()=>{
      reportId??=crypto.randomUUID();const report={id:reportId,completedAt:Date.now(),answers:{...answers}};
      save.disabled=true;const result=savePlan(report);save.disabled=false;
      if(!result){status.textContent='Could not save. Your answers are still here. Try again or download a backup from Settings.';return;}
      answers={};step=0;reportId=null;shell('Your plan is saved');dialog.append(el('p','', 'Five small activities, one place to return to. Choose whichever feels right to start.'),button('View my note',()=>{dialog.close();onSaved(result);},'primary'),button('Done',()=>dialog.close()));
    },'primary');controls.append(button('Back',()=>{step=4;plan();}),save);dialog.append(status,controls);
  }
  root.append(el('div','eyebrow','A LITTLE HELP GETTING STARTED'));const title=el('h1','','Find your next step.');title.id='more-heading';root.append(title,el('p','intro','Feeling anxious, low on energy, overwhelmed, or unsure where to begin? Take a moment, then make a little room for progress.'));
  for(const [title,copy,action,label] of [['Guided Breathing','Follow a gentle two-minute animation to settle down or wake up your attention.',breathe,'Choose a breathing exercise'],['Guided Planning','Choose one small activity for today across work, health, learning, relationships, and spirituality.',()=>{if(step===5)review();else plan();open();},'Start guided planning']]){const card=el('section','settings-card activity-card');card.append(el('h2','',title),el('p','field-hint',copy),button(label,action,'primary'));root.append(card);}
}
