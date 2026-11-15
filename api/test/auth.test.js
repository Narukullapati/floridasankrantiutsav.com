const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'correct horse';
process.env.ADMIN_SESSION_SECRET = 'test-secret';
const { checkCredentials, createSession, readSession } = require('../src/auth');

const reqWith = (cookie) => ({ get: (h) => (h.toLowerCase() === 'cookie' ? cookie : undefined) });

test('checks admin credentials', () => {
  assert.equal(checkCredentials('admin', 'correct horse'), true);
  assert.equal(checkCredentials('admin', 'wrong'), false);
  assert.equal(checkCredentials('other', 'correct horse'), false);
});

test('accepts a signed session cookie', () => {
  const session = readSession(reqWith(`x=1; fsu_admin=${createSession('admin')}`));
  assert.equal(session?.u, 'admin');
});

test('rejects tampered or missing session cookies', () => {
  const [data, sig] = createSession('admin').split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'admin', exp: Date.now() + 1e9 })).toString('base64url');
  assert.equal(readSession(reqWith(`fsu_admin=${forged}.${sig}`)), null);
  assert.equal(readSession(reqWith(`fsu_admin=${data}.bad`)), null);
  assert.equal(readSession(reqWith('')), null);
});
