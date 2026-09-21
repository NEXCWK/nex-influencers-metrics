'use strict';

const express = require('express');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { PRODUCTS, PRODUCT_LIST, computeTotals } = require('../services/couponPricing');
const { renderCouponSaleEmailHtml } = require('../services/couponSaleEmail');
const emailSender = require('../services/emailSender');

const router = express.Router();

// "Cupons Access Pass" is an admin-only master tab — port of the
// nexcupominflu (Lovable) system, ported into our own auth/DB.
router.use(authenticate, requireAdmin);

function getSaleRecipients() {
  const fromEnv = (process.env.COUPON_SALE_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : ['felipe@nex.work', 'luiza@nex.work', 'bruna@nex.work'];
}

// Whether a partner is effectively active right now (active flag AND, for
// "avulso" partners, not past their expiration date). Computed on read
// instead of via a DB cron job, to avoid depending on pg_cron being enabled.
function effectiveActive(partner) {
  if (!partner.active) return false;
  if (partner.category === 'avulso' && partner.expires_at) {
    return new Date(partner.expires_at).getTime() > Date.now();
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /admin/coupon-partners — list all partners
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('coupon_partners')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return res.json({ partners: [], migration_pending: true });
      }
      console.error('GET /admin/coupon-partners error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch partners' });
    }

    const partners = (data || []).map((p) => ({ ...p, effective_active: effectiveActive(p) }));
    return res.json({ partners, products: PRODUCT_LIST });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/coupon-partners — create a partner
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const couponCode = (req.body.coupon_code || '').trim().toUpperCase();
    const category = req.body.category === 'fixo' ? 'fixo' : 'avulso';
    const expiresAt = req.body.expires_at ? new Date(`${req.body.expires_at}T23:59:59`).toISOString() : null;

    if (!name || !couponCode) {
      return res.status(400).json({ error: 'Nome e código do cupom são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('coupon_partners')
      .insert({
        name,
        coupon_code: couponCode,
        category,
        expires_at: category === 'avulso' ? expiresAt : null,
      })
      .select()
      .single();

    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return res.status(409).json({ error: `Já existe um parceiro com o cupom "${couponCode}"` });
      }
      console.error('POST /admin/coupon-partners error:', error.message);
      return res.status(500).json({ error: 'Falha ao criar o parceiro' });
    }

    return res.status(201).json({ partner: { ...data, effective_active: effectiveActive(data) } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/coupon-partners/:id — update a partner (edit or toggle active)
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.coupon_code !== undefined) updates.coupon_code = String(req.body.coupon_code).trim().toUpperCase();
    if (req.body.category !== undefined) updates.category = req.body.category === 'fixo' ? 'fixo' : 'avulso';
    if (req.body.active !== undefined) updates.active = !!req.body.active;
    if (req.body.expires_at !== undefined) {
      updates.expires_at = req.body.expires_at
        ? new Date(`${req.body.expires_at}T23:59:59`).toISOString()
        : null;
    }
    if (updates.category === 'fixo') updates.expires_at = null;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('coupon_partners')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return res.status(409).json({ error: 'Já existe um parceiro com esse código de cupom' });
      }
      console.error('PATCH /admin/coupon-partners/:id error:', error.message);
      return res.status(500).json({ error: 'Falha ao atualizar o parceiro' });
    }
    if (!data) return res.status(404).json({ error: 'Parceiro não encontrado' });

    return res.json({ partner: { ...data, effective_active: effectiveActive(data) } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/coupon-partners/:id — remove a partner (only if no sales)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('coupon_partners')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      if (/foreign key|violates/i.test(error.message)) {
        return res.status(409).json({
          error: 'Este parceiro já tem cupons registrados — desative-o em vez de excluir.',
        });
      }
      console.error('DELETE /admin/coupon-partners/:id error:', error.message);
      return res.status(500).json({ error: 'Falha ao excluir o parceiro' });
    }

    return res.json({ message: 'Parceiro removido' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/coupon-partners/sales — list sales, optionally filtered by month
// Query: ?year=&month=  (both omitted = full history)
// ---------------------------------------------------------------------------
router.get('/sales', async (req, res, next) => {
  try {
    let query = supabase
      .from('coupon_partner_sales')
      .select('*')
      .order('sold_at', { ascending: false });

    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    if (year && month) {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1).toISOString();
      query = query.gte('sold_at', start).lt('sold_at', end);
    }

    const { data, error } = await query;
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return res.json({ sales: [], migration_pending: true });
      }
      console.error('GET /admin/coupon-partners/sales error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    return res.json({ sales: data || [] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/coupon-partners/sales — register a coupon sale manually
// ---------------------------------------------------------------------------
router.post('/sales', async (req, res, next) => {
  try {
    const partnerId = req.body.partner_id;
    const customerName = (req.body.customer_name || '').trim();
    const product = PRODUCTS[req.body.product] ? req.body.product : 'access_pass';
    const paymentConfirmed = !!req.body.payment_confirmed;
    const soldAt = req.body.sold_at ? new Date(`${req.body.sold_at}T12:00:00`).toISOString() : new Date().toISOString();

    if (!partnerId) return res.status(400).json({ error: 'Selecione o influenciador/parceiro' });
    if (!customerName) return res.status(400).json({ error: 'Informe o nome do cliente' });

    const { data: partner, error: partnerError } = await supabase
      .from('coupon_partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerError) return res.status(500).json({ error: 'Failed to verify partner' });
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

    const totals = computeTotals(product);

    const { data: sale, error } = await supabase
      .from('coupon_partner_sales')
      .insert({
        partner_id: partnerId,
        customer_name: customerName,
        product,
        price: totals.price,
        discount_amount: totals.discount,
        amount_paid: totals.amountPaid,
        commission_amount: totals.commission,
        payment_confirmed: paymentConfirmed,
        registered_by_email: req.user.username,
        registered_by_name: req.user.display_name || req.user.username,
        sold_at: soldAt,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /admin/coupon-partners/sales error:', error.message);
      return res.status(500).json({ error: 'Falha ao registrar o cupom' });
    }

    // Best-effort email notification — sale is already saved regardless.
    let emailResult = { sent: false, reason: 'not_attempted' };
    try {
      const html = renderCouponSaleEmailHtml({
        partnerName: partner.name,
        couponCode: partner.coupon_code,
        productLabel: PRODUCTS[product].label,
        customerName,
        amountPaid: totals.amountPaid,
        commission: totals.commission,
        registeredByEmail: req.user.display_name || req.user.username,
        soldAt: sale.sold_at,
        paymentConfirmed,
      });
      emailResult = await emailSender.sendEmail({
        to: getSaleRecipients(),
        subject: `🎟️ NOVO CUPOM UTILIZADO — ${PRODUCTS[product].label} — ${partner.coupon_code} (${partner.name}) · Nex House`,
        html,
      });
    } catch (emailErr) {
      console.error('Coupon sale email failed:', emailErr.message);
      emailResult = { sent: false, error: emailErr.message };
    }

    return res.status(201).json({ sale, email: emailResult });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/coupon-partners/sales/:id — remove a sale record
// ---------------------------------------------------------------------------
router.delete('/sales/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('coupon_partner_sales')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('DELETE /admin/coupon-partners/sales/:id error:', error.message);
      return res.status(500).json({ error: 'Falha ao excluir o registro' });
    }

    return res.json({ message: 'Registro removido' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/coupon-partners/report.csv — monthly CSV export
// Query: ?year=&month=  (both required)
// ---------------------------------------------------------------------------
router.get('/report.csv', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) {
      return res.status(400).json({ error: 'year e month são obrigatórios' });
    }

    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1).toISOString();

    const [{ data: sales, error: salesError }, { data: partners, error: partnersError }] = await Promise.all([
      supabase.from('coupon_partner_sales').select('*').gte('sold_at', start).lt('sold_at', end).order('sold_at', { ascending: true }),
      supabase.from('coupon_partners').select('*'),
    ]);

    if (salesError || partnersError) {
      console.error('report.csv error:', (salesError || partnersError).message);
      return res.status(500).json({ error: 'Failed to build report' });
    }

    const partnerById = {};
    (partners || []).forEach((p) => { partnerById[p.id] = p; });

    const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const money = (n) => Number(n).toFixed(2).replace('.', ',');
    const rows = [];

    rows.push(['Data/Hora', 'Tipo de cupom', 'Influenciador', 'Cupom', 'Categoria', 'Cliente', 'Pagamento confirmado', 'Valor Cheio', 'Desconto', 'Valor Pago', 'Comissão', 'Registrado por'].map(csvCell).join(';'));

    for (const s of sales || []) {
      const p = partnerById[s.partner_id];
      rows.push([
        new Date(s.sold_at).toLocaleString('pt-BR'),
        PRODUCTS[s.product]?.label ?? s.product,
        p?.name ?? '',
        p?.coupon_code ?? '',
        p?.category ?? '',
        s.customer_name,
        s.payment_confirmed ? 'SIM' : 'NÃO',
        money(s.price),
        money(s.discount_amount),
        money(s.amount_paid),
        money(s.commission_amount),
        s.registered_by_email,
      ].map(csvCell).join(';'));
    }

    // Summary block per partner
    const summaryMap = {};
    for (const s of sales || []) {
      if (!summaryMap[s.partner_id]) summaryMap[s.partner_id] = { count: 0, paid: 0, commission: 0 };
      summaryMap[s.partner_id].count += 1;
      summaryMap[s.partner_id].paid += Number(s.amount_paid);
      summaryMap[s.partner_id].commission += Number(s.commission_amount);
    }

    rows.push('');
    rows.push(csvCell('RESUMO POR INFLUENCIADOR'));
    rows.push(['Influenciador', 'Cupom', 'Categoria', 'Qtd Cupons', 'Receita', 'Comissão'].map(csvCell).join(';'));

    let totalCount = 0, totalPaid = 0, totalCommission = 0;
    for (const [partnerId, sum] of Object.entries(summaryMap)) {
      const p = partnerById[partnerId];
      rows.push([p?.name ?? '', p?.coupon_code ?? '', p?.category ?? '', sum.count, money(sum.paid), money(sum.commission)].map(csvCell).join(';'));
      totalCount += sum.count;
      totalPaid += sum.paid;
      totalCommission += sum.commission;
    }
    rows.push(['', '', 'TOTAL', totalCount, money(totalPaid), money(totalCommission)].map(csvCell).join(';'));

    const csv = '﻿' + rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cupons-access-pass-${year}-${String(month).padStart(2, '0')}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
