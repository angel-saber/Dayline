import {Vault,rewrapPassphrase} from './vault-crypto.js';
import {VaultSync,plannerSnapshot,sealSnapshot} from './vault-sync.js';
import {openEncryptedBackup} from './migration.js';
const $=id=>document.getElementById(id);
// A fixed identity ONLY for this isolated, no-network, made-up-data lab.
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',key='dayline.e2ee-lab.server.v1';
const sessions=new Map();let busy=false,activeDevice='desktop';
const status=text=>{$('status').textContent=text;};
const read=()=>JSON.parse(localStorage.getItem(key)||'null');
function display(){
  const row=read();$('ciphertext').textContent=row?JSON.stringify(row,null,2):'No lab vault yet.';
  const active=sessions.get($('device').value);$('editor-panel').hidden=!active||active.stopped;
  if(active&&!active.stopped){
    const note=active.snapshot.state.days['2026-10-24'][0];
    $('title').value=note.title||'';$('note').value=note.text;
    $('device-status').textContent=`${$('device').value==='desktop'?'Desktop':'Phone'} unlocked · ${active.pending?'encrypted draft waiting to sync':'synced'}`;
  }
}
async function action(fn){
  if(busy)return;busy=true;
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await fn();display();}catch(error){status(error.message);}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
const cloud={
  async load(){return read();},
  async save(payload,expected){
    const row=read();if(!row)throw new Error('Test vault missing.');
    if(row.revision!==expected)return {conflict:true,revision:row.revision};
    localStorage.setItem(key,JSON.stringify({...row,payload,revision:row.revision+1}));
    return {conflict:false,revision:row.revision+1};
  },
};
async function useVault(vault){
  const device=$('device').value;
  if(sessions.has(device))await sessions.get(device).lock();
  const session=new VaultSync({vault,cloud,storage:localStorage,tabId:device});
  try{await session.initialize();sessions.set(device,session);}catch(error){vault.lock();throw error;}
}
async function saveEditor(){
  const session=sessions.get(activeDevice);if(!session||session.stopped)return;
  const snapshot=session.snapshot,note=snapshot.state.days['2026-10-24'][0];
  note.title=$('title').value;note.text=$('note').value;await session.stage(snapshot);
}
$('create').onclick=()=>action(async()=>{
  if(read())throw new Error('A lab vault already exists. Unlock it, or use a separate browser profile for a fresh test.');
  const phrase=$('secret').value;$('secret').value='';
  const {vault,recoveryKey}=await Vault.create(owner,phrase);
  const snapshot=plannerSnapshot({version:1,days:{'2026-10-24':[{id:'lab-note',minute:600,title:'A test beginning',text:'Use made-up notes only.',done:false}]},settings:{interval:60,clock:'12'}});
  const payload=await sealSnapshot(vault,snapshot,1);
  localStorage.setItem(key,JSON.stringify({descriptor:vault.descriptor,payload,revision:1}));
  $('recovery').textContent=recoveryKey;$('recovery-panel').hidden=false;
  await useVault(vault);status('Test vault created. Save your recovery key privately before hiding it.');
});
$('unlock-form').onsubmit=event=>{event.preventDefault();action(async()=>{
  const secret=$('secret').value;$('secret').value='';const row=read();if(!row)throw new Error('Create or restore a test vault first.');
  await useVault(await Vault.unlock(row.descriptor,owner,secret,$('method').value));status('Device unlocked.');
});};
$('hide-recovery').onclick=()=>{$('recovery').textContent='';$('recovery-panel').hidden=true;};
$('device').onchange=()=>action(async()=>{await saveEditor();activeDevice=$('device').value;status(sessions.has(activeDevice)?'Device selected.':'Enter your vault secret and unlock this simulated device.');});
$('note-form').onsubmit=event=>{event.preventDefault();action(async()=>{
  await saveEditor();status('Encrypted draft saved. Sync when ready.');
});};
$('sync').onclick=()=>action(async()=>{await saveEditor();await sessions.get($('device').value).sync();status('Encrypted snapshot synced.');});
$('lock').onclick=()=>action(async()=>{
  await saveEditor();
  for(const session of sessions.values())await session.lock();sessions.clear();
  for(const id of ['title','note','secret','new-secret','recovery'])$(id).value!==undefined?$(id).value='':$(id).textContent='';
  $('recovery-panel').hidden=true;status('Both devices locked. Only encrypted lab data remains in browser storage.');
});
$('rewrap-form').onsubmit=event=>{event.preventDefault();action(async()=>{
  const secret=$('secret').value,next=$('new-secret').value;$('secret').value='';$('new-secret').value='';
  const row=read();if(!row)throw new Error('No test vault.');
  const descriptor=await rewrapPassphrase(row.descriptor,owner,secret,next,$('method').value);
  if(read().revision!==row.revision)throw new Error('Test vault changed. Try again.');
  localStorage.setItem(key,JSON.stringify({...row,descriptor,revision:row.revision+1}));
  status('Vault passphrase changed. Download an updated encrypted backup. Previously unlocked sessions still hold the key.');
});};
$('export').onclick=()=>action(async()=>{
  const row=read();if(!row)throw new Error('No test vault to export.');
  const file={format:'dayline-encrypted-backup',v:1,descriptor:row.descriptor,payload:row.payload};
  const url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='dayline-encrypted-test-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Encrypted backup downloaded. Keep its recovery key separately.');
});
$('import').onchange=()=>action(async()=>{
  const file=$('import').files[0];$('import').value='';
  if(!file)return;if(file.size>17005000)throw new Error('Backup exceeds this prototype’s size limit.');
  if(read())throw new Error('Restore into a separate browser profile to avoid overwriting a lab vault.');
  const secret=$('secret').value;$('secret').value='';
  const backup=JSON.parse(await file.text());
  const restored=await openEncryptedBackup(backup,owner,secret,$('method').value);
  // Lab editor supports its fixed sample record only. General planner imports
  // are tested in migration.js, not presented as this simple lab editor.
  if(!restored.snapshot.state.days['2026-10-24']?.some(n=>n.id==='lab-note')){restored.vault.lock();throw new Error('Use a backup created by this lab.');}
  localStorage.setItem(key,JSON.stringify({descriptor:backup.descriptor,payload:backup.payload,revision:restored.sequence}));
  await useVault(restored.vault);status('Encrypted test backup verified and restored.');
});
window.addEventListener('pagehide',()=>{
  // Unload is not a reliable async-save opportunity. Only acknowledged saves
  // survive; secrets/unsaved fields are not written to a plaintext recovery cache.
  for(const session of sessions.values())session.lock().catch(()=>{});
});
display();
