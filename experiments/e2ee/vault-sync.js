import {validState} from '../../dist/js/storage.js';
import {mergeEntries} from '../../dist/js/sync.js';
import {sharedPreferences,validatePreferences} from '../../dist/js/preferences-sync.js';
import {validateDescriptor,validateEnvelope} from './vault-crypto.js';

const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function revision(value){if(!Number.isSafeInteger(value)||value<1)throw new Error('Invalid encrypted revision.');return value;}
export function validateSnapshot(value){
  if(value?.v!==1)throw new Error('Unsupported encrypted planner version.');
  const state=validState(value.state);
  const preferences=validatePreferences({...state.settings,layout:value.layout});
  const {layout,...settings}=preferences;
  return {v:1,state:{...state,settings},layout};
}
export function plannerSnapshot(state,layout='zen'){
  return validateSnapshot({v:1,state,layout});
}
// Authenticated content sequence is inside the ciphertext. An untrusted server
// cannot defeat a cached device's high-water mark by relabeling an old payload
// with a larger outer CAS revision. Wrapper-only updates may advance CAS alone.
export function sealSnapshot(vault,snapshot,sequence){
  return vault.sealJSON({v:1,sequence:revision(sequence),snapshot:validateSnapshot(snapshot)},'snapshot','planner');
}
export async function openSnapshot(vault,payload){
  const packet=await vault.openJSON(payload,'snapshot','planner');
  if(packet?.v!==1)throw new Error('Invalid encrypted snapshot packet.');
  return {sequence:revision(packet.sequence),snapshot:validateSnapshot(packet.snapshot)};
}
export function mergeSnapshots(base,local,remote){
  base=validateSnapshot(base);local=validateSnapshot(local);remote=validateSnapshot(remote);
  const days={};let conflicts=0;
  for(const day of new Set([...Object.keys(base.state.days),...Object.keys(local.state.days),...Object.keys(remote.state.days)])){
    const merged=mergeEntries(base.state.days[day]||[],local.state.days[day]||[],remote.state.days[day]||[]);
    days[day]=merged.entries;conflicts+=merged.conflicts;
  }
  const b=sharedPreferences(base.state.settings,base.layout),l=sharedPreferences(local.state.settings,local.layout),r=sharedPreferences(remote.state.settings,remote.layout);
  const preferences={...r};
  for(const field of Object.keys(l))if(!equal(l[field],b[field])){
    if(!equal(r[field],b[field])&&!equal(r[field],l[field]))conflicts++;
    preferences[field]=l[field];
  }
  const {layout,...settings}=preferences;
  return {snapshot:validateSnapshot({v:1,state:{version:1,days,settings},layout}),conflicts};
}

// The server only sees descriptors and authenticated ciphertext. This adapter
// intentionally exposes no plaintext/legacy fallback and no createUser method.
export class VaultCloud {
  constructor(cloud){this.cloud=cloud;}
  async load(){
    const rows=await this.cloud.signedRequest('/rest/v1/dayline_vaults?select=descriptor,payload,revision');
    if(!Array.isArray(rows)||rows.length>1)throw new Error('Invalid vault response.');
    return rows[0]||null;
  }
  save(payload,expectedRevision){return this.cloud.signedRequest('/rest/v1/rpc/save_dayline_vault',{method:'POST',body:{p_payload:validateEnvelope(payload),p_expected_revision:revision(expectedRevision)}});}
  rewrap(descriptor,expectedRevision){return this.cloud.signedRequest('/rest/v1/rpc/rewrap_dayline_vault',{method:'POST',body:{p_descriptor:descriptor,p_expected_revision:revision(expectedRevision)}});}
  migrate(descriptor,payload,manifest,preferencesRevision){
    return this.cloud.signedRequest('/rest/v1/rpc/migrate_dayline_vault',{method:'POST',body:{p_descriptor:descriptor,p_payload:payload,p_expected_days:manifest,p_expected_preferences_revision:preferencesRevision}});
  }
}

// New async persistence boundary: callers must await stage() before reporting
// "saved". The existing planner's synchronous storage is NOT wired to this yet.
export class VaultSync {
  #vault; #state; #base; #revision; #contentRevision; #stopped=false; #queue=Promise.resolve(); #running;
  constructor({vault,cloud,storage,tabId,onState=()=>{},onStatus=()=>{}}){
    if(!/^[\w-]{1,100}$/.test(tabId))throw new Error('Invalid device draft identity.');
    this.#vault=vault;this.cloud=cloud;this.storage=storage;this.onState=onState;this.onStatus=onStatus;
    const {ownerId,vaultId}=vault.descriptor;
    this.key=`dayline.encrypted-draft:${ownerId}:${vaultId}:${tabId}`;
    this.recordId=`tab:${tabId}`;
  }
  get snapshot(){return this.#state&&copy(this.#state);}
  get pending(){return !equal(this.#base,this.#state);}
  get stopped(){return this.#stopped;}
  #active(){if(this.#stopped||this.#vault.locked)throw new Error('Vault locked.');}
  async #persist(){
    this.#active();
    const draft={v:1,base:copy(this.#base),snapshot:copy(this.#state),revision:this.#revision,contentRevision:this.#contentRevision};
    const envelope=await this.#vault.sealJSON(draft,'draft',this.recordId);
    this.#active();
    await this.storage.setItem(this.key,JSON.stringify(envelope));
  }
  #enqueue(action){
    const work=this.#queue.then(action);
    this.#queue=work.catch(()=>{});return work;
  }
  async initialize(){
    return this.#enqueue(async()=>{
      this.#active();
      const raw=await this.storage.getItem(this.key);
      if(raw){
        const draft=await this.#vault.openJSON(JSON.parse(raw),'draft',this.recordId);
        if(draft.v!==1)throw new Error('Invalid encrypted device draft.');
        this.#base=validateSnapshot(draft.base);this.#state=validateSnapshot(draft.snapshot);this.#revision=revision(draft.revision);
        this.#contentRevision=revision(draft.contentRevision);
      }
      // No blank initialization on a missing/corrupt remote vault.
      await this.#pull();await this.#persist();
      this.onState(this.snapshot);this.onStatus(this.pending?'pending':'synced');
    });
  }
  async #pull(){
    const row=await this.cloud.load();this.#active();
    if(!row)throw new Error('Encrypted vault missing. Sync paused; no plaintext fallback.');
    const descriptor=validateDescriptor(row.descriptor,this.#vault.descriptor.ownerId);
    if(descriptor.vaultId!==this.#vault.descriptor.vaultId)throw new Error('Vault identity changed. Sync paused.');
    revision(row.revision);
    if(this.#revision&&row.revision<this.#revision)throw new Error('Older vault revision received. Sync paused.');
    const packet=await openSnapshot(this.#vault,row.payload),remote=packet.snapshot;
    if(packet.sequence>row.revision||(this.#contentRevision&&packet.sequence<this.#contentRevision))throw new Error('Older encrypted content received. Sync paused.');
    if(packet.sequence===this.#contentRevision&&!equal(remote,this.#base))throw new Error('Encrypted content changed without advancing its sequence.');
    this.#active();
    if(this.#base){
      const merged=mergeSnapshots(this.#base,this.#state,remote);
      this.#state=merged.snapshot;
      if(merged.conflicts)this.onStatus('conflict',new Error('Concurrent changes were preserved; review note versions and settings.'));
    }else this.#state=remote;
    this.#base=remote;this.#revision=row.revision;this.#contentRevision=packet.sequence;
  }
  stage(snapshot){
    const next=validateSnapshot(snapshot);
    return this.#enqueue(async()=>{
      this.#active();if(!this.#base)throw new Error('Unlock and load the vault before editing.');
      this.#state=next;
      try{await this.#persist();this.onStatus('pending');}catch(error){this.onStatus('error',error);throw error;}
    });
  }
  sync(){
    if(this.#running)return this.#running;
    // Network work does not block encrypted local edits. Every integration
    // re-enters the queue, then merges against edits made during the request.
    this.#running=this.#sync().finally(()=>{this.#running=null;});return this.#running;
  }
  async #sync(){
    try{
      await this.#enqueue(async()=>{await this.#pull();await this.#persist();this.onState(this.snapshot);});
      for(let attempt=0;attempt<5;attempt++){
        const sent=await this.#enqueue(async()=>{
          this.#active();if(!this.pending)return null;
          return {snapshot:copy(this.#state),revision:this.#revision};
        });
        if(!sent){this.onStatus('synced');return;}
        const payload=await sealSnapshot(this.#vault,sent.snapshot,sent.revision+1);this.#active();
        const result=await this.cloud.save(payload,sent.revision);
        await this.#enqueue(async()=>{
          this.#active();
          if(result.conflict)await this.#pull();
          else{
            if(revision(result.revision)!==sent.revision+1)throw new Error('Invalid encrypted save response.');
            this.#base=sent.snapshot;this.#revision=result.revision;this.#contentRevision=result.revision;
          }
          await this.#persist();this.onState(this.snapshot);
        });
      }
      throw new Error('Vault kept changing. Your encrypted draft is saved; retry sync.');
    }catch(error){if(!this.#stopped)this.onStatus('error',error);throw error;}
  }
  // Callers flush editors and await stage() before lock(). Never silently
  // discard pending drafts; they remain ciphertext and can resume after unlock.
  async lock(){
    if(this.#stopped)return;
    await this.#enqueue(async()=>{if(this.#state)await this.#persist();});
    this.#stopped=true;this.#vault.lock();this.#state=null;this.#base=null;
    this.onState(null);this.onStatus('locked');
  }
}
