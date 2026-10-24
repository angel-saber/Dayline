// Experimental protocol v1. Platform Web Crypto implements every primitive.
// No account password, unlock passphrase, or unwrapped key belongs on a server.
const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
export const MAX_PLAINTEXT = 12 * 1024 * 1024;
const ITERATIONS = 600000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const failure = () => new Error('Could not unlock or verify this encrypted data. No data was replaced.');
const bytes = size => crypto.getRandomValues(new Uint8Array(size));
const clone = value => structuredClone(value);

function encode(value) {
  let binary='';
  for(let i=0;i<value.length;i+=8192)binary+=String.fromCharCode(...value.subarray(i,i+8192));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(value, min, max=min) {
  if(typeof value!=='string'||value.length>Math.ceil(max*4/3)||!/^[A-Za-z0-9_-]+$/.test(value))throw failure();
  let result;
  try{result=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{throw failure();}
  if(result.length<min||result.length>max||encode(result)!==value)throw failure();
  return result;
}
function identity(ownerId,vaultId){if(!UUID.test(ownerId)||!UUID.test(vaultId))throw failure();}
function phraseBytes(value, creating=false){
  // Preserve exact Unicode/whitespace; no hidden trimming or truncation.
  if(typeof value!=='string'||value.length>1024||!value.length||(creating&&value.length<16))throw new Error('Use an independent vault passphrase of at least 16 characters (up to 1,024).');
  return encoder.encode(value);
}
function context(ownerId,vaultId,kind,id){
  identity(ownerId,vaultId);
  if(!['snapshot','draft','attachment','proof'].includes(kind)||typeof id!=='string'||!/^[\w:.-]{1,160}$/.test(id))throw failure();
  return encoder.encode(JSON.stringify(['dayline.e2ee',1,ownerId,vaultId,kind,id]));
}
function exactKeys(value,keys){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.slice().sort().join(','))throw failure();
}
export function validateEnvelope(value){
  exactKeys(value,['v','alg','key','iv','data']);
  if(value.v!==1||value.alg!=='A256GCM+A256KW')throw failure();
  decode(value.key,40);decode(value.iv,12);decode(value.data,16,MAX_PLAINTEXT+16);
  return clone(value);
}
export function validateDescriptor(value,ownerId){
  exactKeys(value,['v','ownerId','vaultId','passphrase','recovery','proof']);
  identity(value.ownerId,value.vaultId);
  if(value.v!==1||value.ownerId!==ownerId)throw failure();
  exactKeys(value.passphrase,['kdf','iterations','salt','key']);
  exactKeys(value.recovery,['kdf','salt','key']);
  // Fixed cost in v1 prevents server-driven downgrade and unbounded KDF work.
  if(value.passphrase.kdf!=='PBKDF2-SHA256'||value.passphrase.iterations!==ITERATIONS||value.recovery.kdf!=='HKDF-SHA256')throw failure();
  for(const wrapper of [value.passphrase,value.recovery]){decode(wrapper.salt,32);decode(wrapper.key,40);}
  validateEnvelope(value.proof);
  return clone(value);
}
async function passKey(phrase,descriptor){
  const raw=phraseBytes(phrase);
  try{
    const material=await subtle.importKey('raw',raw,'PBKDF2',false,['deriveKey']);
    return await subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,
      salt:encoder.encode(JSON.stringify(['dayline.passphrase.v1',descriptor.ownerId,descriptor.vaultId,descriptor.passphrase.salt]))},material,{name:'AES-KW',length:256},false,['wrapKey','unwrapKey']);
  }finally{raw.fill(0);}
}
async function recoveryKey(value,descriptor){
  if(typeof value!=='string')throw failure();
  const compact=value.replace(/-/g,'');
  if(!/^[0-9a-fA-F]{64}$/.test(compact))throw failure();
  const raw=Uint8Array.from(compact.match(/../g),hex=>parseInt(hex,16));
  try{
    const material=await subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);
    return await subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:decode(descriptor.recovery.salt,32),
      info:encoder.encode(JSON.stringify(['dayline.recovery.v1',descriptor.ownerId,descriptor.vaultId]))},material,{name:'AES-KW',length:256},false,['wrapKey','unwrapKey']);
  }finally{raw.fill(0);}
}
async function unwrap(wrapper,key,extractable=false){
  return subtle.unwrapKey('raw',decode(wrapper.key,40),key,'AES-KW',{name:'AES-KW',length:256},extractable,['wrapKey','unwrapKey']);
}

export class Vault {
  #key; #epoch=0; #descriptor;
  constructor(descriptor,key){this.#descriptor=clone(descriptor);this.#key=key;}
  get descriptor(){return clone(this.#descriptor);}
  get locked(){return !this.#key;}
  lock(){this.#key=null;this.#epoch++;}
  #active(epoch){if(this.locked||epoch!==this.#epoch)throw new Error('Vault locked. Unlock it before continuing.');}

  static async create(ownerId,phrase){
    phraseBytes(phrase,true).fill(0);
    const descriptor={v:1,ownerId,vaultId:crypto.randomUUID(),
      passphrase:{kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:encode(bytes(32)),key:''},
      recovery:{kdf:'HKDF-SHA256',salt:encode(bytes(32)),key:''},proof:null};
    identity(ownerId,descriptor.vaultId);
    const recovery=bytes(32);
    const recoveryText=Array.from(recovery,b=>b.toString(16).padStart(2,'0')).join('').match(/.{8}/g).join('-');
    recovery.fill(0);
    const root=await subtle.generateKey({name:'AES-KW',length:256},true,['wrapKey','unwrapKey']);
    descriptor.passphrase.key=encode(new Uint8Array(await subtle.wrapKey('raw',root,await passKey(phrase,descriptor),'AES-KW')));
    descriptor.recovery.key=encode(new Uint8Array(await subtle.wrapKey('raw',root,await recoveryKey(recoveryText,descriptor),'AES-KW')));
    // Long-lived root is non-extractable. Rewrapping requires a fresh unlock.
    const vault=new Vault(descriptor,await unwrap(descriptor.passphrase,await passKey(phrase,descriptor)));
    descriptor.proof=await vault.sealJSON({purpose:'dayline-vault-proof-v1'},'proof','root');
    vault.#descriptor=clone(descriptor);
    return {vault,recoveryKey:recoveryText};
  }

  static async unlock(descriptor,ownerId,secret,method='passphrase'){
    const valid=validateDescriptor(descriptor,ownerId);
    if(!['passphrase','recovery'].includes(method))throw failure();
    let vault;
    try{
      const kek=method==='passphrase'?await passKey(secret,valid):await recoveryKey(secret,valid);
      vault=new Vault(valid,await unwrap(valid[method],kek));
      const proof=await vault.openJSON(valid.proof,'proof','root');
      if(proof.purpose!=='dayline-vault-proof-v1')throw failure();
      return vault;
    }catch{vault?.lock();throw failure();}
  }

  async seal(value,kind,id){
    const epoch=this.#epoch;this.#active(epoch);
    if(!(value instanceof Uint8Array)||value.length>MAX_PLAINTEXT)throw new Error('Encrypted items must be 12 MB or smaller in this prototype.');
    const aad=context(this.descriptor.ownerId,this.descriptor.vaultId,kind,id),root=this.#key;
    const content=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
    const iv=bytes(12);
    const key=encode(new Uint8Array(await subtle.wrapKey('raw',content,root,'AES-KW')));
    const data=encode(new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},content,value)));
    this.#active(epoch);
    return {v:1,alg:'A256GCM+A256KW',key,iv:encode(iv),data};
  }
  async open(envelope,kind,id){
    const epoch=this.#epoch;this.#active(epoch);
    const valid=validateEnvelope(envelope),root=this.#key;
    try{
      const key=await subtle.unwrapKey('raw',decode(valid.key,40),root,'AES-KW',{name:'AES-GCM',length:256},false,['decrypt']);
      const result=new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv:decode(valid.iv,12),
        additionalData:context(this.descriptor.ownerId,this.descriptor.vaultId,kind,id),tagLength:128},key,decode(valid.data,16,MAX_PLAINTEXT+16)));
      try{this.#active(epoch);}catch(error){result.fill(0);throw error;}
      return result;
    }catch{this.#active(epoch);throw failure();}
  }
  async sealJSON(value,kind,id){
    const raw=encoder.encode(JSON.stringify(value));
    try{return await this.seal(raw,kind,id);}finally{raw.fill(0);}
  }
  async openJSON(envelope,kind,id){
    const raw=await this.open(envelope,kind,id);
    try{return JSON.parse(decoder.decode(raw));}catch{throw failure();}finally{raw.fill(0);}
  }
}

// Recovery changes the independent unlock passphrase, not the account password.
// The encrypted notes and recovery key remain unchanged; CAS must save descriptor.
export async function rewrapPassphrase(descriptor,ownerId,secret,newPhrase,method='passphrase'){
  phraseBytes(newPhrase,true).fill(0);
  const valid=validateDescriptor(descriptor,ownerId);
  const verified=await Vault.unlock(valid,ownerId,secret,method);verified.lock();
  const oldKey=method==='passphrase'?await passKey(secret,valid):await recoveryKey(secret,valid);
  const root=await unwrap(valid[method],oldKey,true);
  valid.passphrase.salt=encode(bytes(32));
  valid.passphrase.key=encode(new Uint8Array(await subtle.wrapKey('raw',root,await passKey(newPhrase,valid),'AES-KW')));
  // Verify the new wrapper before it can be sent anywhere.
  const check=await Vault.unlock(valid,ownerId,newPhrase);check.lock();
  return valid;
}
