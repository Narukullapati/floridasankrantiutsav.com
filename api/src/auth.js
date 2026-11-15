const crypto = require('node:crypto');
const config = require('./config');

const COOKIE = 'fsu_admin';
const COOKIE_PATH = '/api/admin';
const SESSION_MS = 8 * 60 * 60 * 1000;

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const signingKey = () => hash(`fsu-admin-session:${config.admin.sessionSecret || config.admin.password}`);
const sign = (data) => crypto.createHmac('sha256', signingKey()).update(data).digest('base64url');

function checkCredentials(user, pass) {
  if (!config.admin.password) return false;
  const userOk = safeEqual(user ?? '', config.admin.user);
  const passOk = safeEqual(pass ?? '', config.admin.password);
  return userOk && passOk;
}

function createSession(user) {
  const data = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_MS })).toString('base64url');
  return `${data}.${sign(data)}`;
}

function readSession(req) {
  const cookie = (req.get('cookie') || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie || !config.admin.password) return null;
  const [data, sig] = cookie.slice(COOKIE.length + 1).split('.');
  if (!data || !sig || !safeEqual(sig, sign(data))) return null;
  try {
    const session = JSON.parse(Buffer.from(data, 'base64url').toString());
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function basicAuthUser(req) {
  const [scheme, encoded] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Basic') return null;
  const [user, ...rest] = Buffer.from(encoded || '', 'base64').toString().split(':');
  return checkCredentials(user, rest.join(':')) ? user : null;
}

const cookieOptions = (req) => ({
  httpOnly: true,
  secure: req.secure,
  sameSite: 'strict',
  path: COOKIE_PATH,
});

function setSession(req, res, user) {
  res.cookie(COOKIE, createSession(user), { ...cookieOptions(req), maxAge: SESSION_MS });
}

function clearSession(req, res) {
  res.clearCookie(COOKIE, cookieOptions(req));
}

function requireAdmin(req, res, next) {
  if (!config.admin.password) return res.status(503).json({ message: 'Admin access is not configured.' });
  const session = readSession(req);
  const user = session?.u ?? basicAuthUser(req);
  if (user) {
    req.adminUser = user;
    return next();
  }
  res.status(401).json({ message: 'Please sign in.' });
}

module.exports = { checkCredentials, createSession, readSession, setSession, clearSession, requireAdmin };
