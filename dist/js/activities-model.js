import {dayKey,bucket} from './model.js';
export const dimensions=[
  {key:'work',label:'Work',question:'What is one small activity you can do today to move your work or responsibilities forward?',hint:'Draft a paragraph, send one email, or spend two minutes starting.'},
  {key:'health',label:'Health',question:'What is one activity you can do today to care for your body or mind?',hint:'Take a short walk, prepare a meal, rest, or stretch.'},
  {key:'learning',label:'Learning',question:'What is one thing you can explore or practice today?',hint:'Read a few pages, research a question, or practice a skill.'},
  {key:'relationships',label:'Relationships',question:'What is one activity you can do today to nurture a connection?',hint:'Check in with someone, offer help, or make time to listen.'},
  {key:'spirituality',label:'Spirituality',question:'What is one activity you can do today to connect with your values, meaning, or faith?',hint:'Reflect, pray, meditate, spend time in nature, or practice gratitude. Choose what spirituality means to you.'},
];
export function validGuidedReports(reports){
  if(!Array.isArray(reports))throw new Error('Invalid guided activities.');
  const seen=new Set();return reports.map(r=>{
    if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||!Number.isFinite(r.completedAt)||!Number.isFinite(new Date(r.completedAt).getTime())||!r.answers||!dimensions.every(d=>typeof r.answers[d.key]==='string'&&r.answers[d.key].trim()&&r.answers[d.key].length<=2000))throw new Error('Invalid guided activity.');
    seen.add(r.id);return {id:r.id,completedAt:r.completedAt,answers:Object.fromEntries(dimensions.map(d=>[d.key,r.answers[d.key]]))};
  });
}
export function attachGuidedPlan(days,interval,report){
  report=validGuidedReports([report])[0];const now=new Date(report.completedAt),date=dayKey(now),minute=bucket(now.getHours()*60+now.getMinutes(),interval),list=days[date]||[];
  if(list.some(e=>e.guidedActivities?.some(r=>r.id===report.id)))return {days,date,minute};
  const existing=list.find(e=>bucket(e.minute,interval)===minute),entry=existing||{id:`guided-${report.id}`,title:'Guided Planning',text:'',minute,done:false,task:false,format:[],tasks:[]};
  const updated={...entry,guidedActivities:[...(entry.guidedActivities||[]),report]};
  return {date,minute,days:{...days,[date]:existing?list.map(e=>e===existing?updated:e):[...list,updated].sort((a,b)=>a.minute-b.minute)}};
}
export function breathingFrame(elapsed,mode){
  const total=120000,period=mode==='energize'?6000:10000,inhale=mode==='energize'?3000:4000,t=Math.min(total,Math.max(0,elapsed)),phase=t%period;
  return {done:t>=total,remaining:Math.ceil((total-t)/1000),instruction:t>=total?'Take a natural breath.':phase<inhale?'Inhale gently':'Exhale gently',expansion:phase<inhale?phase/inhale:1-(phase-inhale)/(period-inhale)};
}
