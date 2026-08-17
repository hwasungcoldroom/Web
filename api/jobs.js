/* =========================================================
   /api/jobs   —   Hwasung Refrigeration
   Job postings the boss can manage from the Employment page
   while logged in as office. Stored in Vercel Blob.

   GET    /api/jobs             → public. { ok, jobs: [...] }
   POST   /api/jobs             → office only. Add a position.
                                  Body: { role, variant, desc, meta }
   PUT    /api/jobs             → office only. Toggle status.
                                  Body: { id, status: 'open'|'filled' }
   DELETE /api/jobs?id=<uuid>   → office only. Remove a position.

   Uses the same Blob store as the partners list — no extra
   setup beyond the BLOB_READ_WRITE_TOKEN already configured.
   ========================================================= */

'use strict';

const crypto = require('crypto');
const auth = require('./_lib/auth.js');
const store = require('./_lib/jobs-store.js');

const VARIANTS = ['office', 'experienced', 'trainee'];

/* ---------------------------------------------------------
   Optional: announce new job postings on Facebook.
   Configured entirely through env vars — with none set, this
   does nothing. Never blocks or fails the job creation.

   Path A (recommended): Zapier / Make webhook
     JOB_POST_WEBHOOK_URL = the webhook URL from your Zap/scenario
     (Zap: "Webhooks by Zapier → Catch Hook" then
      "Facebook Pages → Create Page Post" using the "message" field)

   Path B: direct Facebook Graph API
     FB_PAGE_ID    = the Facebook Page id
     FB_PAGE_TOKEN = a Page access token with pages_manage_posts
   --------------------------------------------------------- */
async function announceJob(job) {
  const message =
    'NOW HIRING: ' + job.role + '\n\n' +
    (job.desc ? job.desc + '\n\n' : '') +
    (job.meta && job.meta.length ? job.meta.join(' | ') + '\n\n' : '') +
    'Apply at https://hwasung1996.com/employment';

  const timeout = new AbortController();
  const timer = setTimeout(function () { timeout.abort(); }, 6000);

  try {
    if (process.env.JOB_POST_WEBHOOK_URL) {
      await fetch(process.env.JOB_POST_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: timeout.signal,
        body: JSON.stringify({
          message: message,
          role: job.role,
          desc: job.desc || '',
          tags: (job.meta || []).join(', '),
          link: 'https://hwasung1996.com/employment'
        })
      });
    } else if (process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN) {
      await fetch('https://graph.facebook.com/v19.0/' +
        encodeURIComponent(process.env.FB_PAGE_ID) + '/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: timeout.signal,
        body: JSON.stringify({
          message: message,
          access_token: process.env.FB_PAGE_TOKEN
        })
      });
    }
  } catch (e) {
    // Announcement failures are ignored on purpose — the job posting
    // on the website itself must never be affected.
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- GET: public list ---------- */
  if (req.method === 'GET') {
    try {
      const current = await store.readJobs();
      return res.status(200).json({ ok: true, jobs: current.jobs });
    } catch (e) {
      return res.status(200).json({ ok: true, jobs: store.SEED });
    }
  }

  /* ---------- office session required below ---------- */
  const user = auth.currentUser(req);
  if (!user || user.role !== 'office') {
    return res.status(401).json({ ok: false, error: 'Office login required.' });
  }
  if (!store.configured()) {
    return res.status(503).json({
      ok: false,
      error: 'Storage is not set up yet (Blob store not connected).'
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (req.method === 'POST') {
    const role    = String(body.role || '').trim().slice(0, 60);
    const variant = String(body.variant || '').trim();
    const desc    = String(body.desc || '').trim().slice(0, 400);
    const meta    = Array.isArray(body.meta)
      ? body.meta.map(function (m) { return String(m).trim().slice(0, 30); }).filter(Boolean).slice(0, 6)
      : [];

    if (!role) return res.status(400).json({ ok: false, error: 'Please enter the position title.' });
    if (VARIANTS.indexOf(variant) < 0) {
      return res.status(400).json({ ok: false, error: 'Please pick which application form this position uses.' });
    }

    try {
      const current = await store.readJobs();
      const duplicate = current.jobs.some(function (j) {
        return j.role.toLowerCase() === role.toLowerCase();
      });
      if (duplicate) {
        return res.status(400).json({ ok: false, error: 'A position with that title already exists.' });
      }
      const job = { id: crypto.randomUUID(), role: role, variant: variant, desc: desc, meta: meta, status: 'open' };
      current.jobs.push(job);
      await store.writeJobs(current.jobs);
      await announceJob(job);   // no-op unless configured; never throws
      return res.status(200).json({ ok: true, job: job });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'Could not save the position.' });
    }
  }

  if (req.method === 'PUT') {
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== 'open' && status !== 'filled')) {
      return res.status(400).json({ ok: false, error: 'Invalid request.' });
    }
    try {
      const current = await store.readJobs();
      const job = current.jobs.find(function (j) { return j.id === id; });
      if (!job) return res.status(404).json({ ok: false, error: 'Position not found.' });
      job.status = status;
      await store.writeJobs(current.jobs);
      return res.status(200).json({ ok: true, job: job });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'Could not update the position.' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String((req.query && req.query.id) || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid position id.' });
    }
    try {
      const current = await store.readJobs();
      const next = current.jobs.filter(function (j) { return j.id !== id; });
      if (next.length === current.jobs.length) {
        return res.status(404).json({ ok: false, error: 'Position not found.' });
      }
      await store.writeJobs(next);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'Could not delete the position.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
