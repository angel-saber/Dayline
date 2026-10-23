export const NOTE_TYPES={project:'Project',admin:'Admin',event:'Event',personal:'Personal'};
export function validNoteType(value){if(typeof value!=='string'||(value!==''&&!Object.hasOwn(NOTE_TYPES,value)&&!(value.startsWith('custom:')&&value.slice(7).trim()===value.slice(7)&&value.length>7&&value.length<=47&&!/[\u0000-\u001f\u007f]/.test(value))))throw new Error('Invalid note type.');return value;}
export function matchesNoteType(entry,selected){return selected.has(entry.noteType||'none');}
export function categoryLabel(value){return (Object.hasOwn(NOTE_TYPES,value)?NOTE_TYPES[value]:'')||(typeof value==='string'&&value.startsWith('custom:')?value.slice(7):'');}
export function categoryOptions(days={}){const options={...NOTE_TYPES};for(const list of Object.values(days))for(const entry of list)if(entry.noteType?.startsWith('custom:'))options[entry.noteType]=categoryLabel(entry.noteType);return options;}
export function categoryValue(label,options=NOTE_TYPES){label=label.trim().replace(/\s+/g,' ');if(!label||label.length>40)throw new Error('Use a category name of 1–40 characters.');const existing=Object.entries(options).find(([,name])=>name.toLocaleLowerCase()===label.toLocaleLowerCase());return existing?.[0]||validNoteType('custom:'+label);}
export function typeChips(value='',label='Note type',onChange=()=>{},categories={}){
  let selected=validNoteType(value);const options={...NOTE_TYPES,...categories};if(selected)options[selected]=categoryLabel(selected);
  const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='note-type-picker';legend.textContent=label;group.append(legend);
  const buttons=[];function add(key,text){const button=document.createElement('button');button.type='button';button.className='note-type-chip';button.dataset.noteType=key.startsWith('custom:')?'custom':key;button.textContent=text;button.setAttribute('aria-pressed',String(selected===key));button.addEventListener('click',()=>choose(selected===key?'':key));buttons.push([key,button]);group.insertBefore(button,custom);}
  function choose(key){selected=key;for(const [type,chip] of buttons)chip.setAttribute('aria-pressed',String(selected===type));onChange(selected);}
  const custom=document.createElement('details');custom.className='custom-category';const summary=document.createElement('summary');summary.textContent='+ Category';const input=document.createElement('input');input.type='text';input.maxLength=40;input.placeholder='Category name';input.setAttribute('aria-label','Custom category name');const save=document.createElement('button');save.type='button';save.textContent='Add';const error=document.createElement('span');error.setAttribute('role','alert');
  function create(){try{const key=categoryValue(input.value,options);if(!options[key]){options[key]=categoryLabel(key);add(key,options[key]);}choose(key);custom.open=false;input.value='';error.textContent='';}catch(e){error.textContent=e.message;}}
  save.addEventListener('click',create);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();create();}});custom.append(summary,input,save,error);group.append(custom);for(const [key,text] of Object.entries(options))add(key,text);
  return {element:group,get value(){return selected;}};
}
export function typeBadge(value){
  if(!categoryLabel(value))return null;
  const badge=document.createElement('span');badge.className='note-type-badge';badge.dataset.noteType=value.startsWith('custom:')?'custom':value;badge.textContent=categoryLabel(value);return badge;
}
