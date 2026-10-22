export const NOTE_TYPES={project:'Project',admin:'Admin',event:'Event',personal:'Personal'};
export function validNoteType(value){if(typeof value!=='string'||(value!==''&&!Object.hasOwn(NOTE_TYPES,value)))throw new Error('Invalid note type.');return value;}
export function matchesNoteType(entry,selected){return selected.has(entry.noteType||'none');}
export function typeChips(value='',label='Note type',onChange=()=>{}){
  let selected=validNoteType(value);
  const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='note-type-picker';legend.textContent=label;group.append(legend);
  const buttons=[];
  for(const [key,text] of Object.entries(NOTE_TYPES)){
    const button=document.createElement('button');button.type='button';button.className='note-type-chip';button.dataset.noteType=key;button.textContent=text;button.setAttribute('aria-pressed',String(selected===key));
    button.addEventListener('click',()=>{selected=selected===key?'':key;for(const [type,chip] of buttons)chip.setAttribute('aria-pressed',String(selected===type));onChange(selected);});
    buttons.push([key,button]);group.append(button);
  }
  return {element:group,get value(){return selected;}};
}
export function typeBadge(value){
  if(!Object.hasOwn(NOTE_TYPES,value))return null;
  const badge=document.createElement('span');badge.className='note-type-badge';badge.dataset.noteType=value;badge.textContent=NOTE_TYPES[value];return badge;
}
