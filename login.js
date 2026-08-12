/* =========================================================
   POST /api/login   —   Hwasung Refrigeration
   Body: { username, password }
   On success sets an HttpOnly signed session cookie and
   returns { ok: true, role, name }.

   Accounts are configured in env vars — see api/_lib/auth.js.
   ========================================================= */

'use strict';

const auth = require('./_lib/auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!auth.secret()) {
    return res.status(500).json({
      ok: false,
      error: 'Login is not configured yet. (AUTH_SECRET env var is missing.)'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const username = String(body.username || '').trim().slice(0, 60);
  const password = String(body.password || '').slice(0, 120);

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Please enter your username and password.' });
  }

  // Small delay to blunt brute-force attempts.
  await new Promise(function (r) { setTimeout(r, 400); });

  const account = auth.checkCredentials(username, password);
  if (!account) {
    return res.status(401).json({ ok: false, error: 'Incorrect username or password.' });
  }

  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createToken(account.username, account.role)));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, role: account.role, name: account.username });
};
