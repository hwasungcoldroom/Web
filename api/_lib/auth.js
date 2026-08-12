/* =========================================================
   api/_lib/auth.js   —   Hwasung Refrigeration
   Shared helpers for the login system. Files inside api/_lib
   are NOT exposed as endpoints by Vercel (underscore prefix).

   HOW ACCOUNTS WORK (no database needed):
   Accounts live in Vercel environment variables as
   comma-separated  username:password  pairs.

     AUTH_SECRET       required. Long random string used to sign
                       session cookies. Generate one with:
                       node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     OFFICE_ACCOUNTS   e.g.  office:Secret123,mrlee:AnotherPass1
     USER_ACCOUNTS     e.g.  jean:Pass1234,guest:Welcome1

   Office-only dropdown links (optional — default to '#' until
   the owner provides them; can be changed any time without a
   code deploy, just update the env var and redeploy):
     OFFICE_LINK_PETTY_CASH
     OFFICE_LINK_PROJECT
     OFFICE_LINK_BANK_STATEMENT
   ========================================================= */

'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'hw_session';
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

/* ---- base64url helpers ---- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

/* ---- constant-time string compare (avoids timing attacks) ---- */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    // still burn comparable time
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/* ---- parse "user:pass,user2:pass2" env vars ---- */
function parseAccounts(envValue, role) {
  const out = [];
  String(envValue || '').split(',').forEach(function (pair) {
    const idx = pair.indexOf(':');
    if (idx < 1) return;
    const username = pair.slice(0, idx).trim();
    const password = pair.slice(idx + 1).trim();
    if (username && password) out.push({ username: username, password: password, role: role });
  });
  return out;
}

function allAccounts() {
  return parseAccounts(process.env.OFFICE_ACCOUNTS, 'office')
    .concat(parseAccounts(process.env.USER_ACCOUNTS, 'user'));
}

/* ---- find account by credentials; returns {username, role} or null ---- */
function checkCredentials(username, password) {
  const accounts = allAccounts();
  let match = null;
  // Check every account (no early exit) to keep timing uniform.
  accounts.forEach(function (acc) {
    const userOk = safeEqual(acc.username.toLowerCase(), String(username || '').toLowerCase());
    const passOk = safeEqual(acc.password, String(password || ''));
    if (userOk && passOk) match = { username: acc.username, role: acc.role };
  });
  return match;
}

/* ---- token: b64url(payloadJSON) + "." + HMAC ---- */
function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', secret()).update(payloadB64).digest());
}

function createToken(username, role) {
  const payload = b64url(JSON.stringify({
    u: username,
    r: role,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000
  }));
  return payload + '.' + sign(payload);
}

function verifyToken(token) {
  if (!token || !secret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  if (!safeEqual(sign(parts[0]), parts[1])) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(parts[0])); } catch (e) { return null; }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  if (payload.r !== 'office' && payload.r !== 'user') return null;
  return { username: payload.u, role: payload.r };
}

/* ---- cookie helpers ---- */
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function sessionCookie(token) {
  return COOKIE_NAME + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (SESSION_HOURS * 3600);
}

function clearCookie() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/* ---- who is making this request? {username, role} or null ---- */
function currentUser(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

/* ---- office dropdown links, served ONLY to office sessions ---- */
function officeLinks() {
  return {
    pettyCash:     process.env.OFFICE_LINK_PETTY_CASH     || '#',
    project:       process.env.OFFICE_LINK_PROJECT        || '#',
    bankStatement: process.env.OFFICE_LINK_BANK_STATEMENT || '#'
  };
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  secret: secret,
  checkCredentials: checkCredentials,
  createToken: createToken,
  currentUser: currentUser,
  sessionCookie: sessionCookie,
  clearCookie: clearCookie,
  officeLinks: officeLinks
};
