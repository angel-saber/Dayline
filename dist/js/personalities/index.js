import zen from './zen/index.js';
import builder from './builder/index.js';
import founder from './founder/index.js';
import {DEFAULT_COPY} from './default-copy.js';

export const PERSONALITIES=Object.freeze({zen,builder,founder});
export const VOICE_QUOTES=Object.fromEntries(Object.entries(PERSONALITIES).map(([id,value])=>[id,value.quotes]));
export const PERSONALITY_MANTRAS=Object.fromEntries(Object.entries(PERSONALITIES).map(([id,value])=>[id,value.mantras]));
export function getPersonality(id){return PERSONALITIES[id]||PERSONALITIES.zen;}
export function personality(){return typeof document==='undefined'?'zen':document.documentElement.dataset.layout||'zen';}
export function voice(key,mode=personality()){return PERSONALITIES[mode]?.copy[key]||DEFAULT_COPY[key]||key;}
export function focusMantras(fallback,mode=personality()){return PERSONALITY_MANTRAS[mode]||fallback;}
export function focusIdeas(fallback,mode=personality()){return VOICE_QUOTES[mode]||fallback;}
export function applyPersonality(){
 document.querySelectorAll('[data-voice]').forEach(el=>{el.textContent=voice(el.dataset.voice);});
 for(const field of ['name','description'])document.querySelectorAll('[data-personality-'+field+']').forEach(el=>{el.textContent=getPersonality(el.dataset[field==='name'?'personalityName':'personalityDescription'])[field==='description'?'settingsDescription':field];});
}
