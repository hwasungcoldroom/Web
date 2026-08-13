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
