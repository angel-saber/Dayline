import {segments,toggleFormat,editFormat} from './format.js?v=direct-edit-1';
import {lineRange,editTasks,toggleTask} from './tasks.js?v=line-tasks-1';

export function replaceText(state,start,end,text,typingStyle){
  const next=state.text.slice(0,start)+text+state.text.slice(end);
  // Retain the exact selection: repeated words must not move formatting to another line.
  let format=editFormat(state.text,next,state.format,{start,end});
  if(typingStyle&&text.length){
    format=format.flatMap(mark=>[
      ...(mark.start<start?[{...mark,end:Math.min(mark.end,start)}]:[]),
      ...(mark.end>start+text.length?[{...mark,start:Math.max(mark.start,start+text.length)}]:[]),
    ]);
    if(Object.keys(typingStyle).length)format.push({start,end:start+text.length,...typingStyle});
    format.sort((a,b)=>a.start-b.start);
  }
  return {...state,text:next,format,tasks:editTasks(state.text,next,state.tasks,{start,end})};
}
export function applyStyle(state,start,end,key,value=true){
  return {...state,format:toggleFormat(state.text,state.format,start,end,key,value)};
}
export function applyCheckbox(state,caret){return {...state,tasks:toggleTask(state.text,state.tasks,caret)};}
export function checkTask(state,start){return {...state,tasks:state.tasks.map(t=>t.start===start?{...t,done:!t.done}:t)};}
export function selectionStyle(state,start,end){
  if(start===end)({start,end}=lineRange(state.text,start));
  const parts=segments(state.text,state.format).filter(m=>m.start<end&&m.end>start);
  const style={};
  for(const key of ['bold','italic','underline','highlight']){
    if(parts.length&&parts[0][key]&&parts.every(m=>m[key]===parts[0][key]))style[key]=parts[0][key];
  }
  return style;
}

// Enter continues the active tools. Completion belongs to each task, so a new
// checkbox always starts unchecked even when the preceding task is complete.
export function insertLineBreak(state,start,end,typingStyle){
  const style={...(typingStyle??selectionStyle(state,start,end))};
  const task=state.tasks.some(t=>t.start===lineRange(state.text,start).start);
  const next=replaceText(state,start,end,'\n',style),caret=start+1;
  if(task){
    next.tasks=next.tasks.filter(t=>t.start!==caret);
    next.tasks.push({start:caret,done:false});next.tasks.sort((a,b)=>a.start-b.start);
  }
  return {state:next,caret,typingStyle:style};
}
