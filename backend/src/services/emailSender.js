'use strict';

const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Generic SMTP email sender. Works with ANY provider that exposes an SMTP
// relay — a Google Workspace/Office 365 mailbox, or the SMTP endpoint of a
// transactional service (Resend, SendGrid, Postmark, Mailgun, etc.) — so the
// choice of provider doesn't need to be locked in to wire up the rest of the
// reporting pipeline. Configure via env vars once a provider is chosen:
//
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (e.g.
//   "Nex Influencer Metrics <relatorios@nex.work>")
//
// Until those are set, sendEmail() no-ops (logs + returns { sent: false }),
// so the rest of the app (report generation, storage, admin preview) works
// today without an email provider configured.
// ---------------------------------------------------------------------------

let cachedTransporter = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

/**
 * @param {{ to: string[], subject: string, html: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string, error?: string }>}
 */
async function sendEmail({ to, subject, html }) {
  if (!isConfigured()) {
    const reason = 'Nenhum provedor de e-mail configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASS no ambiente).';
    console.warn(`sendEmail: ${reason}`);
    return { sent: false, reason };
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.join(', '),
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('sendEmail failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendEmail, isConfigured };
