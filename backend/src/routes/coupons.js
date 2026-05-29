'use strict';

const express = require('express');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

router.use(authenticate);

function parseYearMonth(query) {
  const now = new Date();
  const year = query.year ? parseInt(query.year, 10) : now.getFullYear();
  const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1;
  return { year, month };
}

// ---------------------------------------------------------------------------
// INFLUENCER: GET /coupons — own counts for a given month (defaults to current)
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);

    const { data, error } = await supabase
      .from('coupon_records')
      .select('gallery_count, atrium_count, access_count, year, month')
      .eq('user_id', req.user.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('GET /coupons error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch coupons' });
    }

    return res.json({
      year,
      month,
      gallery_count: data?.gallery_count ?? 0,
      atrium_count: data?.atrium_count ?? 0,
      access_count: data?.access_count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// INFLUENCER: GET /coupons/history — own monthly history (most recent first)
// ---------------------------------------------------------------------------
router.get('/history', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('coupon_records')
      .select('year, month, gallery_count, atrium_count, access_count, updated_at')
      .eq('user_id', req.user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      console.error('GET /coupons/history error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch coupon history' });
    }

    return res.json({ history: data || [] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ADMIN: GET /coupons/admin — all active influencers with their counts for a month
// ---------------------------------------------------------------------------
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);

    const { data: influencers, error: usersError } = await supabase
      .from('users')
      .select('id, username, display_name')
      .eq('role', 'influencer')
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (usersError) {
      console.error('GET /coupons/admin users error:', usersError.message);
      return res.status(500).json({ error: 'Failed to fetch influencers' });
    }

    const { data: records, error: recordsError } = await supabase
      .from('coupon_records')
      .select('user_id, gallery_count, atrium_count, access_count')
      .eq('year', year)
      .eq('month', month);

    if (recordsError) {
      console.error('GET /coupons/admin records error:', recordsError.message);
      return res.status(500).json({ error: 'Failed to fetch coupon records' });
    }

    const byUser = {};
    (records || []).forEach((r) => { byUser[r.user_id] = r; });

    const rows = (influencers || []).map((inf) => ({
      user_id: inf.id,
      username: inf.username,
      display_name: inf.display_name,
      gallery_count: byUser[inf.id]?.gallery_count ?? 0,
      atrium_count: byUser[inf.id]?.atrium_count ?? 0,
      access_count: byUser[inf.id]?.access_count ?? 0,
    }));

    return res.json({ year, month, rows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ADMIN: PUT /coupons/admin/:userId — set counts for an influencer/month
// Body: { year, month, gallery_count, atrium_count, access_count }
// ---------------------------------------------------------------------------
router.put('/admin/:userId', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = parseInt(req.body.year, 10);
    const month = parseInt(req.body.month, 10);
    const gallery = Math.max(0, parseInt(req.body.gallery_count, 10) || 0);
    const atrium = Math.max(0, parseInt(req.body.atrium_count, 10) || 0);
    const access = Math.max(0, parseInt(req.body.access_count, 10) || 0);

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year e month válidos são obrigatórios' });
    }

    // Verify the target is a real influencer
    const { data: target, error: targetError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) {
      return res.status(500).json({ error: 'Failed to verify user' });
    }
    if (!target || target.role !== 'influencer') {
      return res.status(404).json({ error: 'Influencer not found' });
    }

    const { data, error } = await supabase
      .from('coupon_records')
      .upsert(
        {
          user_id: userId,
          year,
          month,
          gallery_count: gallery,
          atrium_count: atrium,
          access_count: access,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,year,month' }
      )
      .select('user_id, year, month, gallery_count, atrium_count, access_count')
      .single();

    if (error) {
      console.error('PUT /coupons/admin error:', error.message);
      return res.status(500).json({ error: 'Failed to save coupon counts' });
    }

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
