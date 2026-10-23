import { dayKey, dueEntries, bucket } from './model.js?v=exact-note-times-1';
export class Reminders {
  constructor(getState, onDue, onError, onOpen=()=>{},onAudioState=()=>{}) {
    this.getState=getState; this.onDue=onDue; this.onError=onError; this.onOpen=onOpen;this.onAudioState=onAudioState;
    this.last=Date.now(); this.fired=new Set();
    this.timer=setInterval(()=>this.tick(),1000);
  }
  get audioReady(){return this.audio?.state==='running';}
  async unlockAudio() {
    const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;
    if(!Audio)throw new Error('Sound is unavailable in this browser.');
    // Request speaker playback just as Focus audio does, before creating audio.
    try{if(globalThis.navigator?.audioSession)globalThis.navigator.audioSession.type='playback';}catch{/* Optional browser capability. */}
    if(!this.audio||this.audio.state==='closed'){
      this.audio=new Audio();
      this.audio.addEventListener?.('statechange',()=>this.onAudioState());
    }
    let timeout;
    try{
      // Call resume immediately in the click/key handler, not after another await.
      await Promise.race([this.audio.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Sound is blocked or interrupted. Click Test sound in Settings to enable it.')),2000);})]);
      if(!this.audioReady)throw new Error('Sound is paused by your browser. Click Test sound in Settings to enable it.');
    }finally{clearTimeout(timeout);this.onAudioState();}
  }
  async chime() {
    await this.unlockAudio();
    const t=this.audio.currentTime+.03;
    [660,880].forEach((hz,i)=>{
      const o=this.audio.createOscillator(),g=this.audio.createGain(),start=t+i*.22;
      o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(.22,start+.025);g.gain.exponentialRampToValueAtTime(.001,start+.65);
      o.connect(g);g.connect(this.audio.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start(start);o.stop(start+.65);
    });
  }
  tick() {
    const now=Date.now(),state=this.getState(),key=dayKey();
    // Avoid stale alarms when a sleeping device resumes hours later.
    const from=Math.max(this.last,now-60000);this.last=now;
    if(!state.settings.notifications) return;
    let shouldChime=false;
    for(const entry of dueEntries(state.days[key]||[],key,state.settings.interval,from,now)) {
      const token=`${key}:${entry.id}:${entry.minute}`;
      if(this.fired.has(token)) continue; this.fired.add(token);
      const target={date:key,id:entry.id,minute:entry.minute};
      this.onDue(entry,target);
      if(globalThis.Notification?.permission==='granted') {
        try {
          const notification=new Notification('Dayline · It’s time',{body:entry.title?`${entry.title}\n${entry.text}`:entry.text,tag:token});
          notification.onclick=()=>{notification.close();globalThis.focus?.();this.onOpen(target);};
        } catch { /* In-app reminder remains available. */ }
      }
      if(state.settings.sound)shouldChime=true;
    }
    if(shouldChime)this.chime().catch(error=>this.onError(error.message));
  }
}

// Resolve again at click time: a note may have moved or intervals may have changed.
export function resolveReminder(days,target,interval){
  for(const date of [target.date,...Object.keys(days).filter(date=>date!==target.date)]){
    const entry=days[date]?.find(entry=>entry.id===target.id);
    if(entry)return {date,id:entry.id,minute:bucket(entry.minute,interval),found:true};
  }
  return {...target,minute:bucket(target.minute,interval),found:false};
}
