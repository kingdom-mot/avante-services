// /api/contact.js
// Vercel serverless function — receives the contact form submission
// from contact.html and emails it to bile@avanteservices.co.uk using Resend.
//
// Status: avanteservices.co.uk is verified in Resend (DKIM/SPF/DMARC all
// green), RESEND_API_KEY is set in Vercel, and this sends from
// no-reply@avanteservices.co.uk. No further setup needed.

const TO_EMAIL = 'bile@avanteservices.co.uk';
const FROM_EMAIL = 'Avanté Services <no-reply@avanteservices.co.uk>'; // avanteservices.co.uk is verified in Resend

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      name = '',
      company = '',
      email = '',
      phone = '',
      service = '',
      budget = '',
      contactMethod = '',
      message = '',
      company_website = ''
    } = body;

    // Honeypot: real visitors never fill this hidden field. If it's filled,
    // silently report success without sending anything.
    if (String(company_website || '').trim()) {
      return res.status(200).json({ success: true });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!String(name).trim() || !emailOk || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Missing or invalid required fields.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in the Vercel environment.');
      return res.status(500).json({ success: false, error: 'Email service is not configured yet.' });
    }

    const subject = `New enquiry from ${name}${service ? ' — ' + service : ''}`;

    const html = `
      <h2 style="font-family:sans-serif; color:#122448;">New enquiry from the Avanté Services website</h2>
      <table style="font-family:sans-serif; font-size:14px; color:#1B2434; border-collapse:collapse;">
        <tr><td style="padding:6px 12px 6px 0;"><b>Name</b></td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Company</b></td><td>${escapeHtml(company) || '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Email</b></td><td>${escapeHtml(email)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Phone</b></td><td>${escapeHtml(phone) || '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Service interest</b></td><td>${escapeHtml(service) || '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Budget range</b></td><td>${escapeHtml(budget) || '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><b>Preferred contact method</b></td><td>${escapeHtml(contactMethod) || '—'}</td></tr>
      </table>
      <p style="font-family:sans-serif; font-size:14px; color:#1B2434;"><b>Project description:</b></p>
      <p style="font-family:sans-serif; font-size:14px; color:#1B2434; white-space:pre-wrap; border-left:3px solid #E8661C; padding-left:12px;">${escapeHtml(message)}</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject,
        html
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('Resend API error:', resendRes.status, errText);
      return res.status(502).json({ success: false, error: 'Failed to send email.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form handler error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error.' });
  }
};
