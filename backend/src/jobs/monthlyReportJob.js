'use strict';

const supabase = require('../db/supabase');
const { buildMonthlyReport } = require('../services/monthlyReport');
const { renderMonthlyReportHtml } = require('../services/monthlyReportTemplate');
const emailSender = require('../services/emailSender');

const DEFAULT_RECIPIENTS = ['felipe@nex.work', 'luiza@nex.work'];

function getRecipients() {
  const fromEnv = (process.env.MONTHLY_REPORT_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_RECIPIENTS;
}

/**
 * Generates the monthly performance report (for the complete month before
 * `refDate`), saves it to the `monthly_reports` table, and attempts to send
 * it by email. Safe to call on demand (admin "generate now" button) or from
 * the scheduled cron job — always overwrites the stored draft for that
 * period so re-running before the real send doesn't create duplicates.
 *
 * @param {Date} refDate
 * @returns {Promise<{ report: object, saved: object, emailResult: object }>}
 */
async function runMonthlyReportJob(refDate = new Date()) {
  const report = await buildMonthlyReport(refDate);
  const html = renderMonthlyReportHtml(report);
  const recipients = getRecipients();
  const monthLabel = `${report.month}/${report.year}`;

  const emailResult = await emailSender.sendEmail({
    to: recipients,
    subject: `Relatório Mensal de Performance — ${monthLabel}`,
    html,
  });

  const row = {
    report_year: report.year,
    report_month: report.month,
    html,
    recipients,
    sent: !!emailResult.sent,
    sent_at: emailResult.sent ? new Date().toISOString() : null,
    send_error: emailResult.sent ? null : (emailResult.error || emailResult.reason || null),
    generated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from('monthly_reports')
    .upsert(row, { onConflict: 'report_year,report_month' })
    .select()
    .single();

  if (error) {
    console.error('Failed to store monthly report:', error.message);
  }

  return { report, saved: saved || row, emailResult };
}

module.exports = { runMonthlyReportJob, getRecipients };
