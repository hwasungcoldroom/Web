/* =========================================================
   POST /api/logout   —   Hwasung Refrigeration
   Clears the session cookie.
   ========================================================= */

'use strict';

const auth = require('./_lib/auth.js');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  res.setHeader('Set-Cookie', auth.clearCookie());
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
};
