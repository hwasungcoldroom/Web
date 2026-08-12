/* =========================================================
   GET /api/me   —   Hwasung Refrigeration
   Tells the page who is logged in. The nav uses this to show
   Login vs Logout, and — ONLY for office accounts — to reveal
   the Office dropdown and its links.

   Normal users and visitors NEVER receive the office links:
   the check happens here on the server, so hiding cannot be
   bypassed from browser dev tools.

   Responses:
     visitor          → { loggedIn: false }
     normal user      → { loggedIn: true, role: 'user',   name }
     office account   → { loggedIn: true, role: 'office', name,
                          officeLinks: { pettyCash, project, bankStatement } }
   ========================================================= */

'use strict';

const auth = require('./_lib/auth.js');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const user = auth.currentUser(req);
  if (!user) return res.status(200).json({ loggedIn: false });

  const out = { loggedIn: true, role: user.role, name: user.username };
  if (user.role === 'office') out.officeLinks = auth.officeLinks();

  return res.status(200).json(out);
};
