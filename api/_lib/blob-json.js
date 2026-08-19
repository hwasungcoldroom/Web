/* =========================================================
   api/_lib/blob-json.js   —   Hwasung Refrigeration
   Versioned JSON storage on Vercel Blob.

   WHY: overwriting a blob keeps the same URL, and the CDN may
   serve the OLD content from its edge cache for a while — so
   visitors saw stale data after the office made changes.

   HOW: every save writes a brand-new file (data/jobs-v<ts>.json).
   A fresh pathname means a fresh URL the CDN has never cached,
   so reads are always current. Reads pick the newest version;
   older versions (and the legacy single file) are deleted after
   each successful write.
   ========================================================= */

'use strict';

function configured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/* base: e.g. 'data/jobs'  →  versions live at 'data/jobs-v<ms>.json',
   legacy single file at 'data/jobs.json' (from the previous system). */

async function readLatest(base) {
  const { list } = require('@vercel/blob');

  const found = await list({ prefix: base, limit: 1000 });
  const blobs = found.blobs || [];

  const versioned = blobs
    .filter(function (b) { return b.pathname.indexOf(base + '-v') === 0; })
    .sort(function (a, b) { return a.pathname < b.pathname ? 1 : -1; });

  let target = versioned[0];
  if (!target) {
    // migration: fall back to the legacy overwritten file if it exists
    target = blobs.find(function (b) { return b.pathname === base + '.json'; });
  }
  if (!target) return { data: null, found: false };

  const res = await fetch(target.url + '?t=' + Date.now());
  if (!res.ok) throw new Error('blob fetch failed: ' + res.status);
  const data = await res.json();
  return { data: data, found: true };
}

async function writeVersioned(base, data) {
  const { put, list, del } = require('@vercel/blob');

  const pathname = base + '-v' + Date.now() + '.json';
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 60
  });

  // best-effort cleanup: remove every other version + the legacy file
  try {
    const found = await list({ prefix: base, limit: 1000 });
    const old = (found.blobs || []).filter(function (b) {
      return b.pathname !== pathname &&
        (b.pathname.indexOf(base + '-v') === 0 || b.pathname === base + '.json');
    });
    if (old.length) {
      await del(old.map(function (b) { return b.url; }));
    }
  } catch (e) {
    // leftover old versions are harmless — newest always wins on read
  }
}

module.exports = {
  configured: configured,
  readLatest: readLatest,
  writeVersioned: writeVersioned
};
