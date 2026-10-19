import { dayKey, dueEntries } from './model.js';
export class Reminders {
  constructor(getState, onDue, onError) {
    this.getState=getState; this.onDue=onDue; this.onError=onError;
    this.last=Date.now(); this.fired=new Set();
    this.timer=setInterval(()=>this.tick(),1000);
  }
  async unlockAudio() {
    const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;
    if(!Audio) throw new Error('Sound is unavailable in this browser.');
    this.audio??=new Audio(); await this.audio.resume();
  }
  async chime() {
    await this.unlockAudio();
    const t=this.audio.currentTime;
    [660,880].forEach((hz,i)=>{
      const o=this.audio.createOscillator(),g=this.audio.createGain();
      o.frequency.value=hz; g.gain.setValueAtTime(0,t+i*.18);
      g.gain.linearRampToValueAtTime(.12,t+i*.18+.02); g.gain.exponentialRampToValueAtTime(.001,t+i*.18+.5);
      o.connect(g);g.connect(this.audio.destination);o.start(t+i*.18);o.stop(t+i*.18+.5);
    });
  }
  tick() {
    const now=Date.now(),state=this.getState(),key=dayKey();
    // Avoid stale alarms when a sleeping device resumes hours later.
    const from=Math.max(this.last,now-60000);this.last=now;
    if(!state.settings.notifications) return;
    for(const entry of dueEntries(state.days[key]||[],key,state.settings.interval,from,now)) {
      const token=`${key}:${entry.id}:${Math.floor(entry.minute/state.settings.interval)*state.settings.interval}`;
      if(this.fired.has(token)) continue; this.fired.add(token);
      this.onDue(entry);
      if(globalThis.Notification?.permission==='granted') {
        try { new Notification('Dayline · It’s time',{body:entry.text,tag:token}); } catch { /* In-app reminder remains available. */ }
      }
      if(state.settings.sound) this.chime().catch(()=>this.onError('Tap “Test sound” in Settings to enable audio for this session.'));
    }
  }
}
