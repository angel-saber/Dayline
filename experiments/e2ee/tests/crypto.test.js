import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv} from 'node:crypto';
import {Vault,rewrapPassphrase,validateDescriptor,validateEnvelope,MAX_PLAINTEXT} from '../vault-crypto.js';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const phrase='independent vault passphrase for fixtures';
const create=()=>Vault.create(owner,phrase);
const flip=text=>(text[0]==='A'?'B':'A')+text.slice(1);

test('another device and the private recovery key both unlock the same vault',async()=>{
  const {vault,recoveryKey}=await create();
  const value={title:'PRIVATE title',text:'secret note',tags:['custom'],weekly:true,report:{reflection:'private'}};
  const envelope=await vault.sealJSON(value,'snapshot','planner');
  assert.ok(!JSON.stringify({descriptor:vault.descriptor,envelope}).includes('PRIVATE title'));
  const device=await Vault.unlock(vault.descriptor,owner,phrase);
  assert.deepEqual(await device.openJSON(envelope,'snapshot','planner'),value);
  const recovery=await Vault.unlock(vault.descriptor,owner,recoveryKey,'recovery');
  assert.deepEqual(await recovery.openJSON(envelope,'snapshot','planner'),value);
  for(const secret of ['wrong password','0'.repeat(64)])await assert.rejects(Vault.unlock(vault.descriptor,owner,secret,secret.length===64?'recovery':'passphrase'),/Could not unlock/);
  await assert.rejects(Vault.unlock(vault.descriptor,other,phrase),/Could not unlock/);
  for(const instance of [vault,device,recovery])instance.lock();
});

test('ciphertext, nonce, wrapped key, record identity, account and vault are authenticated',async()=>{
  const {vault}=await create(),envelope=await vault.sealJSON({note:'original'},'snapshot','planner');
  for(const field of ['key','iv','data'])await assert.rejects(vault.openJSON({...envelope,[field]:flip(envelope[field])},'snapshot','planner'));
  for(const [kind,id] of [['draft','planner'],['snapshot','another']])await assert.rejects(vault.openJSON(envelope,kind,id));
  const {vault:another}=await create();await assert.rejects(another.openJSON(envelope,'snapshot','planner'));
  const first=await vault.sealJSON({same:'value'},'snapshot','planner'),second=await vault.sealJSON({same:'value'},'snapshot','planner');
  assert.notEqual(first.key,second.key);assert.notEqual(first.data,second.data);
  assert.throws(()=>validateEnvelope({...first,plaintext:'leak'}));
  vault.lock();another.lock();
});

test('recovery rewraps the root for a new passphrase without rewriting encrypted notes',async()=>{
  const {vault,recoveryKey}=await create(),descriptor=vault.descriptor;
  const envelope=await vault.sealJSON({text:'preserve me'},'snapshot','planner');
  const next=await rewrapPassphrase(descriptor,owner,recoveryKey,'my replacement long passphrase','recovery');
  assert.deepEqual(next.recovery,descriptor.recovery);assert.deepEqual(next.proof,descriptor.proof);
  await assert.rejects(Vault.unlock(next,owner,phrase));
  const updated=await Vault.unlock(next,owner,'my replacement long passphrase');
  assert.deepEqual(await updated.openJSON(envelope,'snapshot','planner'),{text:'preserve me'});
  // Old backups remain unlockable with old credentials: rewrap is not revocation.
  (await Vault.unlock(descriptor,owner,phrase)).lock();
  updated.lock();vault.lock();
});

test('unknown versions, KDF downgrades, malformed encodings and oversized data fail closed',async()=>{
  const {vault}=await create(),descriptor=vault.descriptor;
  for(const changed of [{...descriptor,v:2},{...descriptor,passphrase:{...descriptor.passphrase,iterations:1}},{...descriptor,passphrase:{...descriptor.passphrase,iterations:1e12}},{...descriptor,recovery:{...descriptor.recovery,salt:'!'.repeat(43)}}])assert.throws(()=>validateDescriptor(changed,owner));
  await assert.rejects(vault.seal(new Uint8Array(MAX_PLAINTEXT+1),'attachment','file'));
  await assert.rejects(Vault.create(owner,'short'));
  vault.lock();await assert.rejects(vault.sealJSON({},'snapshot','planner'),/locked/);
});

test('locking during a crypto operation never releases decrypted content',async()=>{
  const {vault}=await create(),envelope=await vault.sealJSON({text:'private'},'snapshot','planner');
  const pending=vault.openJSON(envelope,'snapshot','planner');vault.lock();
  await assert.rejects(pending,/locked/);
});

test('Web Crypto envelopes interoperate with independent OpenSSL AES-KW/GCM APIs',async()=>{
  const root=Buffer.alloc(32,7),content=Buffer.alloc(32,9),iv=Buffer.alloc(12,3);
  const descriptor={ownerId:owner,vaultId:'33333333-3333-4333-8333-333333333333'};
  const aad=Buffer.from(JSON.stringify(['dayline.e2ee',1,owner,descriptor.vaultId,'attachment','fixture']));
  const aes=createCipheriv('aes-256-gcm',content,iv);aes.setAAD(aad);
  const data=Buffer.concat([aes.update('OpenSSL interoperability'),aes.final(),aes.getAuthTag()]);
  const kw=createCipheriv('id-aes256-wrap',root,Buffer.alloc(8,0xa6));
  const key=Buffer.concat([kw.update(content),kw.final()]);
  const imported=await crypto.subtle.importKey('raw',root,'AES-KW',false,['wrapKey','unwrapKey']);
  const vault=new Vault(descriptor,imported);
  const result=await vault.open({v:1,alg:'A256GCM+A256KW',key:key.toString('base64url'),iv:iv.toString('base64url'),data:data.toString('base64url')},'attachment','fixture');
  assert.equal(new TextDecoder().decode(result),'OpenSSL interoperability');vault.lock();
});
