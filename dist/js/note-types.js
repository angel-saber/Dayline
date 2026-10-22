export const NOTE_TYPES={project:'Project',admin:'Admin',event:'Event',personal:'Personal'};
export function validNoteType(value){if(typeof value!=='string'||(value!==''&&!Object.hasOwn(NOTE_TYPES,value)))throw new Error('Invalid note type.');return value;}
export function matchesNoteType(entry,selected){return selected.has(entry.noteType||'none');}
export function typeSelect(value='',label='Note type'){
  const select=document.createElement('select');select.setAttribute('aria-label',label);
  for(const [key,text] of [['','None'],...Object.entries(NOTE_TYPES)]){const option=document.createElement('option');option.value=key;option.textContent=text;select.append(option);}
  select.value=value;return select;
}
export function typeBadge(value){
  if(!Object.hasOwn(NOTE_TYPES,value))return null;
  const badge=document.createElement('span');badge.className='note-type-badge';badge.dataset.noteType=value;badge.textContent=NOTE_TYPES[value];return badge;
}
