// First-visit setup stays separate from planner data and personality presentation.
const KEY='dayline.welcome.v1';
export function needsWelcome(storage,entryComplete=false,loginVisible=true){
  if(!entryComplete||loginVisible)return false;
  try{return storage.getItem(KEY)!=='done';}catch{return true;}
}
export function setupWelcome(api){
  const dialog=document.createElement('dialog');dialog.className='welcome-window';dialog.setAttribute('aria-labelledby','welcome-title');
  dialog.innerHTML=`<div class="eyebrow">WELCOME TO DAYLINE</div><h1 id="welcome-title">A little room for your day.</h1>
    <p class="welcome-intro">A simple place to plan, think, and make steady progress—one time interval at a time.</p>
    <ul class="welcome-features"><li>Write and format notes, add titles and checkboxes, and move plans between time slots.</li><li>See your month at a glance and drag notes to a different day.</li><li>Launch Focus Mode with music, a commitment, an interruption log, and a session reflection.</li></ul>
    <section class="welcome-step"><h2>Choose your rhythm</h2><label for="welcome-interval">Time intervals</label><select id="welcome-interval"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60" selected>1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="custom">Custom</option></select><div id="welcome-custom-wrap" hidden><label for="welcome-custom">Custom interval in minutes</label><input id="welcome-custom" type="number" min="1" max="1440" step="1" value="60" required></div></section>
    <section class="welcome-step"><h2>Choose your atmosphere</h2><p class="field-hint">Preview a personality. The look and voice change together.</p><fieldset class="welcome-personalities"><legend class="sr-only">Dayline personality</legend>
    <label><input type="radio" name="welcome-personality" value="zen" checked><strong>Zen</strong><span>Gentle and encouraging.</span></label>
    <label><input type="radio" name="welcome-personality" value="builder"><strong>Builder</strong><span>Visionary and powerful.</span></label>
    <label><input type="radio" name="welcome-personality" value="founder"><strong>Founder</strong><span>Elegant and strategic.</span></label></fieldset>
    <p class="welcome-preview" aria-live="polite"></p></section>
    <p class="field-hint welcome-footnote">You can change these choices anytime in Settings. Notes are saved on this device; download a backup to keep a copy.</p>
    <p class="welcome-error" role="status"></p><div class="inline"><button class="primary welcome-confirm" type="button">Start my day</button><button class="secondary welcome-cancel" type="button" hidden>Cancel</button></div>`;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),interval=$('#welcome-interval'),custom=$('#welcome-custom');
  let original='zen',manual=false,closing=false;
  const variants={
    zen:['A little room for your day.','A simple place to plan, think, and make steady progress—one time interval at a time.','One thoughtful step is enough to begin.'],
    builder:['Make room. Lock in.','Turn your day into focused execution: plan your targets, protect your attention, and move the work forward.','Choose a target. Take the next concrete action.'],
    founder:['Give your next move an edge.','Plan your priorities, find the highest-value move, and invest your attention where it can make a difference.','Find the move that makes the next one easier.'],
  };
  function selected(){return $('input[name="welcome-personality"]:checked').value;}
  function preview(){const mode=selected(),copy=variants[mode];window.dispatchEvent(new CustomEvent('dayline:preview-layout',{detail:mode}));$('#welcome-title').textContent=copy[0];$('.welcome-intro').textContent=copy[1];$('.welcome-preview').textContent=copy[2];}
  interval.addEventListener('change',()=>{$('#welcome-custom-wrap').hidden=interval.value!=='custom';});
  dialog.querySelectorAll('input[name="welcome-personality"]').forEach(input=>input.addEventListener('change',preview));
  function open(revisit=false){
    if(dialog.open||closing||!api.canOpen())return;
    if(!revisit)api.showDaily();
    manual=revisit;original=document.documentElement.dataset.layout||'zen';
    const minutes=revisit?api.getState().settings.interval:60;
    interval.value=[15,30,60,120,240].includes(minutes)?String(minutes):'custom';custom.value=minutes;$('#welcome-custom-wrap').hidden=interval.value!=='custom';
    dialog.querySelector(`input[value="${revisit?original:'zen'}"]`).checked=true;
    $('.welcome-cancel').hidden=!revisit;$('.welcome-error').textContent='';preview();dialog.showModal();dialog.scrollTop=0;
  }
  function cancel(){if(closing||!manual)return;window.dispatchEvent(new CustomEvent('dayline:preview-layout',{detail:original}));dialog.close();}
  $('.welcome-cancel').addEventListener('click',cancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  $('.welcome-confirm').addEventListener('click',()=>{
    const minutes=Number(interval.value==='custom'?custom.value:interval.value);
    if(interval.value==='custom'&&!custom.reportValidity())return;
    if(!Number.isInteger(minutes)||minutes<1||minutes>1440)return;
    if(!api.saveInterval(minutes)){$('.welcome-error').textContent='Your browser could not save your choices. Please try again.';return;}
    window.dispatchEvent(new CustomEvent('dayline:set-layout',{detail:selected()}));
    try{localStorage.setItem(KEY,'done');}catch{api.toast('Setup applied for this visit. Your browser could not remember that setup is complete.');}
    closing=true;dialog.classList.add('welcome-leaving');$('.welcome-confirm').disabled=true;
    const finish=()=>{dialog.close();dialog.classList.remove('welcome-leaving');$('.welcome-confirm').disabled=false;closing=false;};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,420);
  });
  document.querySelector('#reopen-welcome').addEventListener('click',()=>open(true));
  function checkEntry(){
    if(!api.canOpen()){
      if(dialog.open){window.dispatchEvent(new CustomEvent('dayline:preview-layout',{detail:original}));dialog.close();}
      return;
    }
    try{if(needsWelcome(localStorage,true,false))open();}catch{open();}
  }
  window.addEventListener('dayline:entry-view',checkEntry);
  checkEntry();
  return {open};
}
