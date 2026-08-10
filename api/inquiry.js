/* =========================================================
   POST /api/inquiry   —   Peak Operations Partner
   Receives the contact form from index.html and emails it via Resend.

   Runs on Vercel with NO npm dependencies. The browser sends a plain
   JSON body; this calls the Resend REST API with fetch. Nothing to
   install, no package.json.

   Environment variables (Vercel → Settings → Environment Variables):
     RESEND_API_KEY    required.  From resend.com → API Keys.
     INQUIRY_TO        optional.  Recipient.
                                  Defaults to peakoperationspartner@gmail.com
     INQUIRY_FROM      optional.  Sender. Defaults to onboarding@resend.dev,
                                  which needs no domain setup but can ONLY
                                  deliver to the address that owns the Resend
                                  account. Once your domain is verified in
                                  Resend, set this to something like
                                  Peak Website <hello@yourdomain.com>
   ========================================================= */

'use strict';

const TO_DEFAULT   = 'peakoperationspartner@gmail.com';
const FROM_DEFAULT = 'Peak Website <onboarding@resend.dev>';

// Must match the <option> values in index.html.
const SERVICES = [
  'Executive Operations',
  'Business Operations',
  'Marketing Operations',
  'Systems & Automation',
  'Procurement & Vendor Operations',
  'Talent & Recruitment Operations',
  'An embedded operator',
  'Not sure yet'
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
       <td style="padding:10px 14px;background:#FAF9F7;border:1px solid #E6E2DE;font-weight:600;white-space:nowrap;vertical-align:top;font-size:13px">${escapeHtml(label)}</td>
       <td style="padding:10px 14px;border:1px solid #E6E2DE;font-size:14px">${value}</td>
     </tr>`;

  const message = escapeHtml(data.message).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#F2EFEC;font-family:Arial,Helvetica,sans-serif;color:#38383A">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E6E2DE;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#242222;color:#fff">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FF9963">New inquiry</div>
      <div style="font-size:20px;font-weight:700;margin-top:5px">${escapeHtml(data.company)}</div>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', escapeHtml(data.name))}
        ${row('Company', escapeHtml(data.company))}
        ${row('Email', `<a href="mailto:${escapeHtml(data.email)}" style="color:#FF5A0A">${escapeHtml(data.email)}</a>`)}
        ${row('Interested in', escapeHtml(data.service))}
        ${row("What's going on", message)}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#8A8A8C">
        Sent from the contact form on your Peak site.
        Reply to this email to reach ${escapeHtml(data.name)} directly.
      </p>
    </div>
  </div>
</body></html>`;
}

function buildText(data) {
  return [
    'New inquiry — Peak',
    '',
    'Name:          ' + data.name,
    'Company:       ' + data.company,
    'Email:         ' + data.email,
    'Interested in: ' + data.service,
    '',
    "What's going on:",
    data.message,
    '',
    '--',
    'Sent from the contact form on your Peak site.'
  ].join('\n');
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
      error: 'The form is not configured yet. Please email us directly at ' + TO_DEFAULT + '.'
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

  // Spam trap — a real visitor never fills this in.
  if (clean(body.botcheck, 20)) {
    return res.status(200).json({ ok: true });        // pretend success, send nothing
  }

  const data = {
    name:    clean(body.name, 120),
    company: clean(body.company, 160),
    email:   clean(body.email, 200),
    service: clean(body.service, 60),
    message: clean(body.message, 4000)
  };

  // ---- validation (never trust the browser) ----
  const problems = [];
  if (!data.name) problems.push('name');
  if (!data.company) problems.push('company');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) problems.push('email address');
  if (!data.message) problems.push('message');
  if (SERVICES.indexOf(data.service) === -1) data.service = 'Not sure yet';

  // Header injection guard: newlines have no business in these fields.
  if (/[\r\n]/.test(data.name + data.email + data.company)) problems.push('name');

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
        // `from` must stay on YOUR verified domain. Putting the visitor's
        // address here is the classic mistake that lands mail in spam,
        // because it fails SPF and DKIM. Use reply_to instead.
        from: process.env.INQUIRY_FROM || FROM_DEFAULT,
        to: [process.env.INQUIRY_TO || TO_DEFAULT],
        reply_to: data.email,
        subject: `New inquiry — ${data.company} — ${data.service}`,
        html: buildHtml(data),
        text: buildText(data)
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Resend rejected the email:', response.status, detail);
      return res.status(502).json({
        ok: false,
        error: 'We could not send your inquiry just now. Please try again, or email us at ' + TO_DEFAULT + '.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to reach Resend:', error);
    return res.status(502).json({
      ok: false,
      error: 'We could not send your inquiry just now. Please try again, or email us at ' + TO_DEFAULT + '.'
    });
  }
};
