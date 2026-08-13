/* =========================================================
   POST /api/apply   —   Hwasung Refrigeration
   Receives a job application from employment.html and emails it,
   with the CV attached, via Resend.

   Runs on Vercel with NO npm dependencies: the browser sends the CV
   already base64-encoded inside a JSON body, and Resend accepts
   base64 attachments directly. Nothing to install, no package.json.

   Environment variables (set these in Vercel → Settings → Environment Variables):
     RESEND_API_KEY   required.  From resend.com → API Keys.
     APPLY_TO         optional.  Recipient. Defaults to hwasungcoldroom@gmail.com
     APPLY_FROM       optional.  Sender. Defaults to onboarding@resend.dev,
                                 which works with no domain setup but can only
                                 deliver to the address that owns the Resend
                                 account. Once hwasung1996.com is verified in
                                 Resend, set this to something like
                                 careers@hwasung1996.com
   ========================================================= */

'use strict';

const TO_DEFAULT   = 'hwasungcoldroom@gmail.com';
const FROM_DEFAULT = 'Hwasung Careers <onboarding@resend.dev>';

// Vercel caps a serverless request body at 4.5 MB, and base64 inflates a file
// by about a third — so the real ceiling for a CV is roughly 3 MB.
const MAX_CV_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXT  = /\.(pdf|docx)$/i;

// Fallback list only — the live check reads the job postings the boss
// manages on the Employment page (api/_lib/jobs-store.js), so newly
// added positions are automatically accepted and filled ones rejected.
const jobsStore = require('./_lib/jobs-store.js');
const POSITIONS = [
  'Freelancer / Part-Timer',
  'Office / Admin',
  'Experienced Technician',
  'No-Experience Technician'
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function buildHtml(data) {
  const row = (label, value) =>
    `<tr>
       <td style="padding:8px 14px;background:#f6f9fb;border:1px solid #dce4e9;font-weight:600;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
       <td style="padding:8px 14px;border:1px solid #dce4e9">${value}</td>
     </tr>`;

  const experience = data.experience.length
    ? data.experience.map(escapeHtml).join('<br>')
    : '<em style="color:#55707f">None selected</em>';

  const details = data.details
    ? escapeHtml(data.details).replace(/\n/g, '<br>')
    : '<em style="color:#55707f">None provided</em>';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#eef4f7;font-family:Arial,Helvetica,sans-serif;color:#14202b">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dce4e9;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#1e5a8c;color:#fff">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">New Job Application</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(data.position)}</div>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Name', escapeHtml(data.firstName + ' ' + data.lastName))}
        ${row('Mobile', `<a href="tel:${escapeHtml(data.mobile.replace(/[^\d+]/g, ''))}">${escapeHtml(data.mobile)}</a>`)}
        ${row('Email', `<a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>`)}
        ${row('Relevant experience', experience)}
        ${row('Additional information', details)}
        ${row('CV', escapeHtml(data.cvName) + ' <span style="color:#55707f">(attached)</span>')}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#55707f">
        Sent from the Employment page on hwasung1996.com.
        Reply to this email to reach the applicant directly.
      </p>
    </div>
  </div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set in the Vercel environment.');
    return res.status(500).json({
      ok: false,
      error: 'The application form is not configured yet. Please call us instead.'
    });
  }

  // Vercel parses a JSON body automatically; guard anyway.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Could not read the form. Please try again.' });
  }

  // Spam trap — a real applicant never fills this in.
  if (clean(body.honey, 20)) {
    return res.status(200).json({ ok: true });        // pretend success, send nothing
  }

  const data = {
    position:  clean(body.position, 60),
    firstName: clean(body.firstName, 80),
    lastName:  clean(body.lastName, 80),
    mobile:    clean(body.mobile, 40),
    email:     clean(body.email, 160),
    details:   clean(body.details, 300),
    experience: Array.isArray(body.experience)
      ? body.experience.slice(0, 5).map(v => clean(v, 60)).filter(Boolean)
      : [],
    cvName: clean(body.cvName, 200)
  };

  // ---- validation (never trust the browser) ----
  const problems = [];
  let openRoles;
  try { openRoles = await jobsStore.openRoles(); } catch (e) { openRoles = POSITIONS; }
  if (!openRoles || !openRoles.length) openRoles = POSITIONS;
  if (openRoles.indexOf(data.position) === -1) problems.push('position');
  if (!data.firstName) problems.push('first name');
  if (!data.lastName) problems.push('last name');
  if (!/^[\d\s()+.-]{7,20}$/.test(data.mobile)) problems.push('mobile number');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) problems.push('email address');
  if (!ALLOWED_EXT.test(data.cvName)) problems.push('CV file type');

  const base64 = typeof body.cvBase64 === 'string' ? body.cvBase64 : '';
  if (!base64) {
    problems.push('CV file');
  } else if (Buffer.byteLength(base64, 'base64') > MAX_CV_BYTES) {
    return res.status(413).json({
      ok: false,
      error: 'That CV is too large. Please upload a file under 3 MB.'
    });
  }

  if (problems.length) {
    return res.status(400).json({
      ok: false,
      error: 'Please check these fields and try again: ' + problems.join(', ') + '.'
    });
  }

  // ---- send it ----
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.APPLY_FROM || FROM_DEFAULT,
        to: [process.env.APPLY_TO || TO_DEFAULT],
        reply_to: data.email,
        subject: `Job application — ${data.position} — ${data.firstName} ${data.lastName}`,
        html: buildHtml(data),
        attachments: [{ filename: data.cvName, content: base64 }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Resend rejected the email:', response.status, detail);
      return res.status(502).json({
        ok: false,
        error: 'We could not send your application just now. Please try again, or email us directly.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to reach Resend:', error);
    return res.status(502).json({
      ok: false,
      error: 'We could not send your application just now. Please try again, or email us directly.'
    });
  }
};
