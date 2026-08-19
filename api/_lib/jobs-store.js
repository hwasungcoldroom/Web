/* =========================================================
   api/_lib/jobs-store.js   —   Hwasung Refrigeration
   Job postings stored in Vercel Blob (data/jobs.json), same
   pattern as the partners list. Falls back to the built-in
   seed (jobs-seed.json) until the first edit is saved.
   Used by /api/jobs (manage) and /api/apply (validation).
   ========================================================= */

'use strict';

const SEED = require('./jobs-seed.json');
const blobJson = require('./blob-json.js');

const BASE = 'data/jobs';   // versioned files: data/jobs-v<timestamp>.json

function configured() {
  return blobJson.configured();
}

async function readJobs() {
  if (!configured()) return { jobs: SEED.slice(), fromSeed: true };
  const r = await blobJson.readLatest(BASE);
  if (!r.found) return { jobs: SEED.slice(), fromSeed: true };
  return { jobs: Array.isArray(r.data) ? r.data : [], fromSeed: false };
}

async function writeJobs(jobs) {
  await blobJson.writeVersioned(BASE, jobs);
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
