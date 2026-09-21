'use strict';

// Port do e-mail de notificação de nexcupominflu/src/lib/notify.functions.ts,
// adaptado para ser enviado via SMTP (services/emailSender.js) em vez do
// Gmail Connector do Lovable Cloud.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * @param {object} sale
 * @param {string} sale.partnerName
 * @param {string} sale.couponCode
 * @param {string} sale.productLabel
 * @param {string} sale.customerName
 * @param {number} sale.amountPaid
 * @param {number} sale.commission
 * @param {string} sale.registeredByEmail
 * @param {string} sale.soldAt - ISO date string
 * @param {boolean} sale.paymentConfirmed
 */
function renderCouponSaleEmailHtml(sale) {
  const dateStr = new Date(sale.soldAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:Arial,Helvetica,sans-serif;">
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:0;color:#111">
    <div style="background:#000;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <div style="font-size:11px;letter-spacing:3px;color:#FFD400;font-weight:700;text-transform:uppercase">${esc(sale.productLabel)} · Nex House</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">Novo cupom utilizado</div>
    </div>
    <div style="border:1px solid #e5e5e5;border-top:0;border-radius:0 0 8px 8px;padding:20px 24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#666">Tipo de cupom</td><td style="padding:6px 0;text-align:right;font-weight:600">${esc(sale.productLabel)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Influenciador</td><td style="padding:6px 0;text-align:right;font-weight:600">${esc(sale.partnerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Cupom</td><td style="padding:6px 0;text-align:right;font-family:monospace">${esc(sale.couponCode)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;text-align:right">${esc(sale.customerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Pagamento confirmado</td><td style="padding:6px 0;text-align:right;font-weight:600">${sale.paymentConfirmed ? 'SIM' : 'NÃO'}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Valor pago</td><td style="padding:6px 0;text-align:right;font-weight:700">${brl(sale.amountPaid)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Comissão influenciador</td><td style="padding:6px 0;text-align:right">${brl(sale.commission)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Data</td><td style="padding:6px 0;text-align:right">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Registrado por</td><td style="padding:6px 0;text-align:right">${esc(sale.registeredByEmail)}</td></tr>
      </table>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderCouponSaleEmailHtml };
