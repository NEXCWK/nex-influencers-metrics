'use strict';

const express = require('express');
const bcrypt = require('bcrypt');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const metricsService = require('../services/metrics');
const storage = require('../services/storage');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'nex2026';

// ---------------------------------------------------------------------------
// Helper: parse year/month from query, defaulting to current month
// ---------------------------------------------------------------------------
function parseYearMonth(query) {
  const now = new Date();
  const year = query.year ? parseInt(query.year, 10) : now.getFullYear();
  const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1;
  return { year, month };
}

// ---------------------------------------------------------------------------
// Helper: attach signed image URLs to a list of posts
// ---------------------------------------------------------------------------
async function attachSignedUrls(posts) {
  return Promise.all(
    (posts || []).map(async (post) => {
      const signedUrl = post.image_url
        ? await storage.getSignedUrl(post.image_url)
        : null;
      return { ...post, signed_image_url: signedUrl };
    })
  );
}

// ---------------------------------------------------------------------------
// Helper: convert posts array to CSV string
// ---------------------------------------------------------------------------
function buildCsv(posts) {
  const headers = [
    'post_id',
    'influencer_username',
    'influencer_name',
    'title',
    'platform',
    'published_at',
    'uploaded_at',
    'confirmed',
    'reach',
    'impressions',
    'likes',
    'comments',
    'shares',
    'saves',
    'plays',
    'engagement_rate',
    'profile_visits',
    'link_clicks',
    'manually_edited',
  ];

  const escape = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = posts.map((p) => {
    const m = Array.isArray(p.metrics) ? p.metrics[0] : p.metrics || {};
    const user = p.user || {};
    return [
      p.id,
      user.username,
      user.display_name,
      p.title,
      p.platform,
      p.published_at,
      p.uploaded_at,
      p.confirmed_by_user,
      m.reach,
      m.impressions,
      m.likes,
      m.comments,
      m.shares,
      m.saves,
      m.plays,
      m.engagement_rate,
      m.profile_visits,
      m.link_clicks,
      m.manually_edited,
    ].map(escape).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// ---------------------------------------------------------------------------
// GET /admin/overview  ?year=&month=
// ---------------------------------------------------------------------------
router.get('/overview', async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);
    const overview = await metricsService.getAdminOverview(year, month);
    return res.json(overview);
  } catch (err) {
    console.error('GET /admin/overview error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/influencers  ?year=&month=&sortBy=reach
// ---------------------------------------------------------------------------
router.get('/influencers', async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);
    const sortBy = req.query.sortBy || 'reach';
    const ranking = await metricsService.getInfluencersRanking(year, month, sortBy);
    return res.json({ year, month, sort_by: sortBy, ranking });
  } catch (err) {
    console.error('GET /admin/influencers error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/influencers/:id/dashboard  ?year=&month=
// Full dashboard data for a specific influencer
// ---------------------------------------------------------------------------
router.get('/influencers/:id/dashboard', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { year, month } = parseYearMonth(req.query);

    // Verify user exists and is an influencer
    const { data: influencer, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, role, is_active, last_login')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      console.error('Dashboard user fetch error:', userError.message);
      return res.status(500).json({ error: 'Failed to fetch influencer' });
    }
    if (!influencer) {
      return res.status(404).json({ error: 'Influencer not found' });
    }

    // Fetch summary, history and posts in parallel
    const [summary, history, postsResult] = await Promise.all([
      metricsService.getMonthlySummary(id, year, month),
      metricsService.getMonthlyHistory(id, 12),
      metricsService
        .getAllPostsFiltered({ influencerId: id, year, month, page: 1, pageSize: 50 })
        .catch(() => ({ posts: [], total: 0 })),
    ]);

    const postsWithUrls = await attachSignedUrls(postsResult.posts);

    return res.json({
      influencer,
      year,
      month,
      summary,
      history,
      posts: postsWithUrls,
      posts_total: postsResult.total,
    });
  } catch (err) {
    console.error('GET /admin/influencers/:id/dashboard error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/posts  — paginated, filterable list of all posts
// Query: ?influencerId=&year=&month=&platform=&startDate=&endDate=&page=&pageSize=
// ---------------------------------------------------------------------------
router.get('/posts', async (req, res, next) => {
  try {
    const {
      influencerId,
      year,
      month,
      platform,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = req.query;

    const result = await metricsService.getAllPostsFiltered({
      influencerId,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      platform,
      startDate,
      endDate,
      page: parseInt(page, 10),
      pageSize: Math.min(parseInt(pageSize, 10), 100),
    });

    const postsWithUrls = await attachSignedUrls(result.posts);

    return res.json({
      posts: postsWithUrls,
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
      total_pages: result.totalPages,
    });
  } catch (err) {
    console.error('GET /admin/posts error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/posts/:id/prints — all signed print URLs for a post
// ---------------------------------------------------------------------------
router.get('/posts/:id/prints', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Admin get prints fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const prints = await storage.listImages(post.image_url);
    return res.json({ prints });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/posts/:id — delete any post, metrics, and storage image
// ---------------------------------------------------------------------------
router.delete('/posts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Admin delete post fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Delete metrics first
    await supabase.from('metrics').delete().eq('post_id', id);

    // Delete post record
    const { error: deleteError } = await supabase.from('posts').delete().eq('id', id);
    if (deleteError) {
      console.error('Admin post delete DB error:', deleteError.message);
      return res.status(500).json({ error: 'Failed to delete post' });
    }

    // Delete storage image (best effort)
    if (post.image_url) {
      try {
        await storage.deleteImage(post.image_url);
      } catch (storageErr) {
        console.error('Admin storage delete error (non-fatal):', storageErr.message);
      }
    }

    return res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/posts/:id — edit metrics of any post
// ---------------------------------------------------------------------------
router.patch('/posts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify post exists
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Admin patch post fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Build update payload from allowed fields
    const allowedFields = [
      'reach', 'impressions', 'likes', 'comments', 'shares',
      'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks',
    ];

    const updates = { manually_edited: true };
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field] != null ? Number(req.body[field]) : null;
      }
    }

    const { error: upsertError } = await supabase
      .from('metrics')
      .upsert({ post_id: id, ...updates }, { onConflict: 'post_id' });

    if (upsertError) {
      console.error('Admin metrics upsert error:', upsertError.message);
      return res.status(500).json({ error: 'Failed to update metrics' });
    }

    // Return updated metrics
    const { data: updatedMetrics } = await supabase
      .from('metrics')
      .select('*')
      .eq('post_id', id)
      .single();

    return res.json({ metrics: updatedMetrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/export — export posts as CSV
// Query: same filters as /admin/posts (no pagination)
// ---------------------------------------------------------------------------
router.get('/export', async (req, res, next) => {
  try {
    const { influencerId, year, month, platform, startDate, endDate } = req.query;

    const rows = await metricsService.exportPostsCSV({
      influencerId,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      platform,
      startDate,
      endDate,
    });

    const csv = buildCsv(rows);
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=export-metricas-${dateStr}.csv`
    );
    return res.send(csv);
  } catch (err) {
    console.error('GET /admin/export error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/users — list all users
// ---------------------------------------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, is_active, last_login, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET /admin/users DB error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    return res.json({ users: users || [] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/users/:id/reset-password — reset to default password
// ---------------------------------------------------------------------------
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Reset password fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, must_change_password: true })
      .eq('id', id);

    if (updateError) {
      console.error('Reset password update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    return res.json({
      message: `Password for "${user.username}" has been reset to the default.`,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/toggle — toggle is_active boolean
// ---------------------------------------------------------------------------
router.patch('/users/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    // Fetch current state
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, username, is_active')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Toggle user fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newStatus = !user.is_active;

    const { error: updateError } = await supabase
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', id);

    if (updateError) {
      console.error('Toggle user update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to update user status' });
    }

    return res.json({
      message: `User "${user.username}" is now ${newStatus ? 'active' : 'deactivated'}.`,
      is_active: newStatus,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
