import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudClient, validateConfig, takeSignInReturn } from '../../dist/js/features/accounts/cloud.js';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const session = { user: { id: 'one', email: 'test@example.com' }, access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600 };

test('password sign-in stores only the session and uses it to load private notes', async () => {
  const calls=[], local=storage();
  const client=new CloudClient(config,{storage:local,fetcher:async(url,options)=>{
    calls.push({url,...options});return new Response(JSON.stringify(url.includes('grant_type=password')?session:[]));
  }});
  await client.signInPassword('test@example.com','fixture-password');
  await client.loadDays();
  assert.equal(calls[0].url,'https://example.supabase.co/auth/v1/token?grant_type=password');
  assert.deepEqual(JSON.parse(calls[0].body),{email:'test@example.com',password:'fixture-password'});
  assert.equal(calls[1].headers.Authorization,'Bearer test-access');
  assert.ok(!local.getItem(client.sessionKey).includes('fixture-password'));
});

test('rejected passwords leave the prior session intact and do not trigger signup or email', async () => {
  const urls=[],local=storage();
  const client=new CloudClient(config,{storage:local,fetcher:async url=>{
    urls.push(url);return new Response(JSON.stringify({msg:'Invalid login credentials'}),{status:400});
  }});
  client.storeSession(session);
  await assert.rejects(client.signInPassword('other@example.com','incorrect'),/Check your email and password/);
  assert.equal(client.readSession().user.id,'one');assert.equal(urls.length,1);
  assert.ok(urls[0].endsWith('grant_type=password'));
});

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

test('browser fetch receives its global receiver instead of the CloudClient instance', async () => {
  const client = new CloudClient(config, {storage:storage(), fetcher:async function () {
    assert.equal(this, globalThis, 'Window.fetch must be called with the browser global');
    return new Response('{}');
  }});
  await client.sendCode('test@example.com');
});

test('timeouts have a specific retry message and never imply notes were lost', async () => {
  const client = new CloudClient(config, {storage:storage(), fetcher:async () => {
    throw new DOMException('timeout', 'TimeoutError');
  }});
  await assert.rejects(client.sendCode('test@example.com'), /too long.*try again.*kept on this device/);
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

test('private sign-in links bind the callback to this browser with a SHA-256 challenge', async () => {
  const calls = [], local = storage();
  const client = new CloudClient(config, { storage: local, locks: null, fetcher: async (url, opts) => {
    calls.push({ url, ...opts });
    return new Response(JSON.stringify(url.includes('grant_type=pkce') ? session : {}));
  } });
  await client.sendLink('test@example.com', 'https://dayline.example/Dayline/');
  const sent = JSON.parse(calls[0].body);
  const pending = JSON.parse(local.getItem(`${client.sessionKey}:link`));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier));
  assert.equal(sent.code_challenge, Buffer.from(hash).toString('base64url'));
  assert.equal(sent.code_challenge_method, 's256');
  assert.equal(sent.create_user, false);
  assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'), 'https://dayline.example/Dayline/');
  assert.equal(sent.code_verifier, undefined);
  await client.exchangeLink('one-time-test-code');
  assert.equal(JSON.parse(calls[1].body).code_verifier, pending.verifier);
  assert.equal(client.readSession().user.id, 'one');
  assert.equal(local.getItem(`${client.sessionKey}:link`), null);
});

test('link callbacks require a recent browser request and the requested account', async () => {
  const local = storage(); let calls = 0;
  const client = new CloudClient(config, { storage: local, locks: null, fetcher: async () => {
    calls++; return new Response(JSON.stringify(session));
  } });
  await assert.rejects(client.exchangeLink('test-code'), /same browser/);
  local.setItem(`${client.sessionKey}:link`, JSON.stringify({verifier:'test',email:'test@example.com',created:1}));
  await assert.rejects(client.exchangeLink('test-code'), /same browser/);
  assert.equal(calls, 0);
  local.setItem(`${client.sessionKey}:link`, JSON.stringify({verifier:'test',email:'another@example.com',created:Date.now()}));
  await assert.rejects(client.exchangeLink('test-code'), /did not match/);
  assert.equal(client.readSession(), null);
  assert.equal(local.getItem(`${client.sessionKey}:link`), null);
});

test('callbacks remove auth details from history and reject unsolicited URL sessions', () => {
  let cleaned;
  const history = {replaceState:(_state, _title, url) => {cleaned = url;}};
  assert.deepEqual(takeSignInReturn({href:'https://dayline.example/Dayline/?code=test-code&view=daily'}, history), {code:'test-code'});
  assert.equal(cleaned, '/Dayline/?view=daily');
  assert.ok(takeSignInReturn({href:'https://dayline.example/Dayline/#access_token=test&refresh_token=test'}, history).error);
  assert.equal(cleaned, '/Dayline/');
  assert.ok(takeSignInReturn({href:'https://dayline.example/Dayline/#error=access_denied&error_description=test'}, history).error);
  assert.equal(takeSignInReturn({href:'https://dayline.example/Dayline/#weekly'}, history), null);
});
