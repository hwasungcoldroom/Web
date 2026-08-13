/* =========================================================
   api/_lib/jobs-store.js   —   Hwasung Refrigeration
   Job postings stored in Vercel Blob (data/jobs.json), same
   pattern as the partners list. Falls back to the built-in
   seed (jobs-seed.json) until the first edit is saved.
   Used by /api/jobs (manage) and /api/apply (validation).
   ========================================================= */

'use strict';

const SEED = require('./jobs-seed.json');

const BLOB_PATH = 'data/jobs.json';

function configured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function readJobs() {
  if (!configured()) return { jobs: SEED.slice(), fromSeed: true };
  const { list } = require('@vercel/blob');
  const found = await list({ prefix: BLOB_PATH, limit: 1 });
  const blob = (found.blobs || []).find(function (b) { return b.pathname === BLOB_PATH; });
  if (!blob) return { jobs: SEED.slice(), fromSeed: true };

  const res = await fetch(blob.url + '?t=' + Date.now());
  if (!res.ok) throw new Error('blob fetch failed: ' + res.status);
  const data = await res.json();
  return { jobs: Array.isArray(data) ? data : [], fromSeed: false };
}

async function writeJobs(jobs) {
  const { put } = require('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify(jobs), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

/* Role names of positions currently open — used by /api/apply so
   applications are accepted for exactly the jobs shown as Available. */
async function openRoles() {
  try {
    const current = await readJobs();
    return current.jobs
      .filter(function (j) { return j.status === 'open'; })
      .map(function (j) { return j.role; });
  } catch (e) {
    return SEED
      .filter(function (j) { return j.status === 'open'; })
      .map(function (j) { return j.role; });
  }
}

module.exports = {
  configured: configured,
  readJobs: readJobs,
  writeJobs: writeJobs,
  openRoles: openRoles,
  SEED: SEED
};
