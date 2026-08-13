/* =========================================================
   /api/partners   —   Hwasung Refrigeration
   Partner list stored as a JSON file in VERCEL BLOB storage,
   so the boss can add/remove partners from the website while
   logged in as office. No external database needed.

   GET    /api/partners            → public. { ok, partners: [...] }
   POST   /api/partners            → office session only.
                                     Body: { region, name, location }
   DELETE /api/partners?id=<uuid>  → office session only.

   SETUP (one time, in the Vercel dashboard):
     Project → Storage → Create → Blob → connect to this project.
     Vercel adds the BLOB_READ_WRITE_TOKEN env var automatically.
     Then redeploy.

   Until the store exists, GET serves the built-in seed list
   (api/_lib/partners-seed.json) and edits return a clear error.
   ========================================================= */

'use strict';

const crypto = require('crypto');
const auth = require('./_lib/auth.js');
const SEED = require('./_lib/partners-seed.json');

const BLOB_PATH = 'data/partners.json';
const ALLOWED_REGIONS = ['1', '2', '3', '4A', '4B', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'NCR', 'CAR', 'BARMM'];

function blobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/* Read the current list: the stored blob if it exists, else the seed. */
async function readPartners() {
  const { list } = require('@vercel/blob');
  const found = await list({ prefix: BLOB_PATH, limit: 1 });
  const blob = (found.blobs || []).find(function (b) { return b.pathname === BLOB_PATH; });
  if (!blob) return { partners: SEED.slice(), fromSeed: true };

  // cache-busting query so we always read the freshest version
  const res = await fetch(blob.url + '?t=' + Date.now());
  if (!res.ok) throw new Error('blob fetch failed: ' + res.status);
  const data = await res.json();
  return { partners: Array.isArray(data) ? data : [], fromSeed: false };
}

async function writePartners(partners) {
  const { put } = require('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify(partners), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- GET: public list ---------- */
  if (req.method === 'GET') {
    try {
      if (!blobConfigured()) return res.status(200).json({ ok: true, partners: SEED });
      const current = await readPartners();
      return res.status(200).json({ ok: true, partners: current.partners });
    } catch (e) {
      return res.status(200).json({ ok: true, partners: SEED });
    }
  }

  /* ---------- everything below requires an office session ---------- */
  const user = auth.currentUser(req);
  if (!user || user.role !== 'office') {
    return res.status(401).json({ ok: false, error: 'Office login required.' });
  }

  if (!blobConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Storage is not set up yet. In Vercel: Storage tab, create a Blob store, connect it to this project, then redeploy.'
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const region   = String(body.region || '').trim().toUpperCase();
    const name     = String(body.name || '').trim().slice(0, 120);
    const location = String(body.location || '').trim().slice(0, 120);

    if (ALLOWED_REGIONS.indexOf(region) < 0) {
      return res.status(400).json({ ok: false, error: 'Please pick a valid region.' });
    }
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Please enter the partner name.' });
    }

    try {
      const current = await readPartners();
      const partner = { id: crypto.randomUUID(), region: region, name: name, location: location };
      current.partners.push(partner);
      await writePartners(current.partners);
      return res.status(200).json({ ok: true, partner: partner });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'Could not save the partner.' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String((req.query && req.query.id) || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid partner id.' });
    }
    try {
      const current = await readPartners();
      const next = current.partners.filter(function (p) { return p.id !== id; });
      if (next.length === current.partners.length) {
        return res.status(404).json({ ok: false, error: 'Partner not found.' });
      }
      await writePartners(next);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'Could not delete the partner.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
