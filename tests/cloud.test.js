import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudClient, validateConfig } from '../dist/js/cloud.js';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const session = { user: { id: 'one', email: 'test@example.com' }, access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600 };

test('configuration rejects privileged credentials and insecure or path URLs', () => {
  assert.equal(validateConfig({ url: '', publishableKey: '' }), null);
  for (const url of ['http://example.com', 'https://example.com/other', 'https://user:password@example.com']) assert.throws(() => validateConfig({ ...config, url }));
  for (const key of ['sb_secret_bad', 'service_role', 'eyJhbGci']) assert.throws(() => validateConfig({ ...config, publishableKey: key }));
});
test('email-code verification saves a session and authenticated requests use its token', async () => {
  const calls = [], local = storage();
  const client = new CloudClient(config, { storage: local, fetcher: async (url, opts) => {
    calls.push({ url, ...opts }); return new Response(JSON.stringify(url.endsWith('/verify') ? session : []));
  } });
  await client.sendCode('test@example.com'); await client.verifyCode('test@example.com', '123456'); await client.loadDays();
  assert.equal(JSON.parse(calls[0].body).create_user, false);
  assert.equal(JSON.parse(calls[1].body).type, 'email');
  assert.equal(calls[2].headers.Authorization, 'Bearer test-access');
  assert.equal(client.readSession().user.id, 'one');
});
test('expired sessions refresh once for concurrent requests', async () => {
  let refreshed = 0;
  const client = new CloudClient(config, { storage: storage(), locks: null, fetcher: async url => {
    if (url.includes('/token?')) { refreshed++; await new Promise(r => setTimeout(r, 5)); return new Response(JSON.stringify(session)); }
    return new Response('[]');
  } });
  client.storeSession({ ...session, expires_at: 1 });
  await Promise.all([client.loadDays(), client.loadDays()]); assert.equal(refreshed, 1);
});
test('unsigned clients cannot fetch or save account notes', async () => {
  let called = false; const client = new CloudClient(config, { storage: storage(), fetcher: async () => { called = true; } });
  await assert.rejects(client.loadDays(), /sign in/i); assert.equal(called, false);
});
test('a refresh response cannot sign a user back in after logout', async () => {
  let finish; const local = storage();
  const client = new CloudClient(config, { storage: local, locks: null, fetcher: () => new Promise(r => { finish = r; }) });
  client.storeSession({ ...session, expires_at: 1 }); const pending = client.session();
  local.removeItem(client.sessionKey); finish(new Response(JSON.stringify(session)));
  await assert.rejects(pending, /signed out/); assert.equal(client.readSession(), null);
});
test('sign-out revokes only this session and clears its browser credentials', async () => {
  const urls = []; const client = new CloudClient(config, { storage: storage(), fetcher: async url => { urls.push(url); return new Response(null, { status: 204 }); } });
  client.storeSession(session); await client.signOut();
  assert.ok(urls[0].endsWith('/logout?scope=local')); assert.equal(client.readSession(), null);
});

test('sign-up must be explicitly requested when asking for an email code', async () => {
  const bodies=[];
  const client=new CloudClient(config,{storage:storage(),fetcher:async(url,opts)=>{bodies.push(JSON.parse(opts.body));return new Response('{}');}});
  await client.sendCode('test@example.com');
  await client.sendCode('test@example.com',{createUser:true});
  await client.sendCode('test@example.com',{createUser:false});
  assert.deepEqual(bodies.map(body=>body.create_user),[false,true,false]);
});
