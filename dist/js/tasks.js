// A task belongs to a newline-delimited line, anchored at its text offset.
export function lineRange(text,caret){
  const start=text.lastIndexOf('\n',Math.max(0,caret)-1)+1;
  const next=text.indexOf('\n',caret);
  return {start:caret===0?0:start,end:next<0?text.length:next};
}
export function validTasks(value,text){
  if(!Array.isArray(value))throw new Error('Invalid line tasks.');
  const seen=new Set();
  return value.map(task=>{
    if(!task||!Number.isInteger(task.start)||task.start<0||task.start>text.length||(task.start>0&&text[task.start-1]!=='\n')||typeof task.done!=='boolean'||seen.has(task.start))throw new Error('Invalid line task.');
    seen.add(task.start);return {start:task.start,done:task.done};
  }).sort((a,b)=>a.start-b.start);
}
export function noteTasks(entry){
  if(entry?.tasks)return structuredClone(entry.tasks);
  // Older versions had one checkbox for the note. Keep it on the first line.
  return entry&&entry.task!==false?[{start:0,done:entry.done}]:[];
}
export function toggleTask(text,tasks,caret){
  const {start}=lineRange(text,caret);
  return tasks.some(t=>t.start===start)?tasks.filter(t=>t.start!==start):[...tasks,{start,done:false}].sort((a,b)=>a.start-b.start);
}
export function editTasks(before,after,tasks,change){
  let start=0;
  while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let oldEnd=before.length,newEnd=after.length;
  while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
  // Native beforeinput offsets disambiguate repeated letters across adjacent lines.
  if(change){start=change.start;oldEnd=change.end;newEnd=oldEnd+after.length-before.length;}
  const delta=newEnd-oldEnd,result=[];
  for(const task of tasks){
    let anchor=task.start;
    // Removing an entire task line must not transfer its checkmark to the next line.
    const line=lineRange(before,anchor);
    if(anchor>=start&&oldEnd>line.end&&before[line.end]==='\n')continue;
    if(anchor>start){if(anchor<oldEnd)continue;anchor+=delta;}
    anchor=lineRange(after,Math.min(anchor,after.length)).start;
    if(!result.some(t=>t.start===anchor))result.push({...task,start:anchor});
  }
  return result.sort((a,b)=>a.start-b.start);
}
