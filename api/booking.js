/* =========================================================
   POST /api/booking   —   Hwasung Refrigeration
   Receives a "We'll call you back" consultation request from the Book Now
   modal (present on every page) and emails it via Resend.

   Shares the same setup as api/apply.js — see SETUP-EMAIL.md. It reads the
   same RESEND_API_KEY, so once that is configured both forms work.

   Environment variables:
     RESEND_API_KEY   required.  Same key as the application form.
     BOOKING_TO       optional.  Recipient. Falls back to APPLY_TO, then to
                                 hwasungcoldroom@gmail.com
     APPLY_FROM       optional.  Sender, shared with the application form.
   ========================================================= */

'use strict';

const TO_DEFAULT   = 'hwasungcoldroom@gmail.com';
const FROM_DEFAULT = 'Hwasung Website <onboarding@resend.dev>';

const REQUEST_TYPES = ['New Order', 'After Service'];

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
       <td style="padding:8px 14px;background:#f6f9fb;border:1px solid #dce4e9;font-weight:600;white-space:nowrap">${escapeHtml(label)}</td>
       <td style="padding:8px 14px;border:1px solid #dce4e9">${value}</td>
     </tr>`;

  const types = data.requestType.length
    ? data.requestType.map(escapeHtml).join(', ')
    : '<em style="color:#55707f">Not specified</em>';

  const dial = data.phone.replace(/[^\d+]/g, '');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#eef4f7;font-family:Arial,Helvetica,sans-serif;color:#14202b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce4e9;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#1e5a8c;color:#fff">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Callback Request</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(data.fullName)}</div>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Name', escapeHtml(data.fullName))}
        ${row('Phone', `<a href="tel:${escapeHtml(dial)}" style="font-size:16px;font-weight:700">${escapeHtml(data.phone)}</a>`)}
        ${row('Request type', types)}
      </table>
      <p style="margin:22px 0 0;padding:14px 16px;background:#eaf3f8;border-left:3px solid #1e5a8c;font-size:14px">
        <strong>They are expecting a call.</strong> No email address was collected —
        the form only asks for a name and number.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#55707f">
        Sent from the Book Now form on hwasung1996.com.
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
      error: 'The form is not configured yet. Please call us instead.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Could not read the form. Please try again.' });
  }

  // Spam trap — a real visitor never fills this in.
  if (clean(body.honey, 20)) {
    return res.status(200).json({ ok: true });        // pretend success, send nothing
  }

  const data = {
    fullName: clean(body.fullName, 120),
    phone:    clean(body.phone, 40),
    requestType: Array.isArray(body.requestType)
      ? body.requestType
          .slice(0, 2)
          .map(v => clean(v, 40))
          .filter(v => REQUEST_TYPES.indexOf(v) !== -1)
      : []
  };

  const problems = [];
  if (!data.fullName) problems.push('name');
  if (!/^[\d\s()+.-]{7,20}$/.test(data.phone)) problems.push('phone number');
  if (problems.length) {
    return res.status(400).json({
      ok: false,
      error: 'Please check your ' + problems.join(' and ') + ' and try again.'
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.APPLY_FROM || FROM_DEFAULT,
        to: [process.env.BOOKING_TO || process.env.APPLY_TO || TO_DEFAULT],
        subject: `Callback request — ${data.fullName}` +
                 (data.requestType.length ? ` (${data.requestType.join(', ')})` : ''),
        html: buildHtml(data)
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Resend rejected the email:', response.status, detail);
      return res.status(502).json({
        ok: false,
        error: 'We could not send your request just now. Please call us instead.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to reach Resend:', error);
    return res.status(502).json({
      ok: false,
      error: 'We could not send your request just now. Please call us instead.'
    });
  }
};
