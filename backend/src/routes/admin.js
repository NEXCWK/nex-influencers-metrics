'use strict';

const express = require('express');
const bcrypt = require('bcrypt');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const metricsService = require('../services/metrics');
const storage = require('../services/storage');
const ai = require('../services/ai');

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
    'post_type',
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
      p.post_type,
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
      postType,
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
      postType,
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
// Helper: map an AI extraction result to a metrics upsert payload
// ---------------------------------------------------------------------------
function aiResultToMetricsPayload(postId, result) {
  const num = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const extra =
    result && result.extra && typeof result.extra === 'object' && Object.keys(result.extra).length > 0
      ? result.extra
      : null;

  return {
    post_id: postId,
    reach: num(result?.reach),
    impressions: num(result?.impressions),
    likes: num(result?.likes),
    comments: num(result?.comments),
    shares: num(result?.shares),
    saves: num(result?.saves),
    plays: num(result?.plays),
    engagement_rate: num(result?.engagement_rate),
    profile_visits: num(result?.profile_visits),
    link_clicks: num(result?.link_clicks),
    manually_edited: false,
    ...(extra != null ? { extra_metrics: extra } : {}),
  };
}

// ---------------------------------------------------------------------------
// POST /admin/posts/:id/reprocess — re-run AI extraction on a post's stored
// prints and overwrite its metrics. Skips posts whose metrics were manually
// edited (unless body.force === true) so human corrections are never lost.
// ---------------------------------------------------------------------------
router.post('/posts/:id/reprocess', async (req, res, next) => {
  try {
    const { id } = req.params;
    const force = req.body && req.body.force === true;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Reprocess fetch post error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (!post.image_url) {
      return res.status(400).json({ error: 'Este post não possui prints armazenados' });
    }

    // Preserve manual corrections unless explicitly forced.
    const { data: existing } = await supabase
      .from('metrics')
      .select('manually_edited')
      .eq('post_id', id)
      .maybeSingle();

    if (existing && existing.manually_edited && !force) {
      return res.json({ skipped: true, reason: 'manually_edited' });
    }

    // Download every stored print and re-run AI extraction.
    const images = await storage.downloadPostPrints(post.image_url);
    if (images.length === 0) {
      return res.status(400).json({ error: 'Não foi possível ler os prints armazenados deste post' });
    }

    let result;
    try {
      result = await ai.extractMetricsFromImages(images);
    } catch (aiErr) {
      console.error('Reprocess AI error:', aiErr.message);
      return res.status(502).json({ error: `Falha na extração por IA: ${aiErr.message}` });
    }

    // Persist raw AI response (best effort — column may not exist yet).
    const { error: rawErr } = await supabase
      .from('posts')
      .update({ ai_raw_response: result })
      .eq('id', id);
    if (rawErr && !/ai_raw_response/i.test(rawErr.message)) {
      console.warn('Reprocess ai_raw_response warning:', rawErr.message);
    }

    // Upsert metrics, with graceful fallback if extra_metrics column is missing.
    const payload = aiResultToMetricsPayload(id, result);
    let { error: upsertError } = await supabase
      .from('metrics')
      .upsert(payload, { onConflict: 'post_id' });

    if (upsertError && /extra_metrics/i.test(upsertError.message)) {
      const { extra_metrics: _dropped, ...without } = payload;
      const retry = await supabase.from('metrics').upsert(without, { onConflict: 'post_id' });
      upsertError = retry.error;
    }

    if (upsertError) {
      console.error('Reprocess metrics upsert error:', upsertError.message);
      return res.status(500).json({ error: 'Falha ao salvar métricas reprocessadas' });
    }

    const { data: metrics } = await supabase
      .from('metrics')
      .select('*')
      .eq('post_id', id)
      .single();

    return res.json({
      metrics,
      confidence: result.confidence ?? null,
      notes: result.notes ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/posts/all-ids — every post id on the platform (for bulk reprocess)
// ---------------------------------------------------------------------------
router.get('/posts/all-ids', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Admin all-ids error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch post ids' });
    }
    return res.json({ ids: (data || []).map((p) => p.id) });
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

    // --- Post-level fields: date/month, title and type ---
    // Editing published_at moves the post between months on the dashboards,
    // no need to delete and re-upload.
    const postUpdates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'published_at')) {
      const d = req.body.published_at;
      if (d != null && d !== '') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          return res.status(400).json({ error: 'A data deve estar no formato AAAA-MM-DD' });
        }
        postUpdates.published_at = d;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'post_type')) {
      postUpdates.post_type = req.body.post_type === 'story' ? 'story' : 'feed';
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'title') && String(req.body.title).trim()) {
      postUpdates.title = String(req.body.title).trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'post_url')) {
      const url = String(req.body.post_url || '').trim();
      if (url && !/^https?:\/\/\S+$/i.test(url)) {
        return res.status(400).json({ error: 'O link do post deve ser uma URL válida (http/https)' });
      }
      postUpdates.post_url = url || null;
    }

    if (Object.keys(postUpdates).length > 0) {
      let { error: postErr } = await supabase.from('posts').update(postUpdates).eq('id', id);
      // Graceful fallback if post_url / post_type columns don't exist yet.
      if (postErr && /post_url/i.test(postErr.message) && Object.prototype.hasOwnProperty.call(postUpdates, 'post_url')) {
        const { post_url: _droppedUrl, ...rest } = postUpdates;
        postErr = Object.keys(rest).length > 0
          ? (await supabase.from('posts').update(rest).eq('id', id)).error
          : null;
      }
      if (postErr && /post_type/i.test(postErr.message) && postUpdates.post_type) {
        const { post_type: _dropped, ...rest } = postUpdates;
        postErr = Object.keys(rest).length > 0
          ? (await supabase.from('posts').update(rest).eq('id', id)).error
          : null;
      }
      if (postErr) {
        console.error('Admin post update error:', postErr.message);
        return res.status(500).json({ error: 'Falha ao atualizar os dados do post' });
      }
    }

    // --- Metric fields (only touch metrics when at least one was sent, so
    // editing just the date doesn't create an empty manually-edited row) ---
    const allowedFields = [
      'reach', 'impressions', 'likes', 'comments', 'shares',
      'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks',
    ];

    const metricUpdates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        metricUpdates[field] = req.body[field] != null ? Number(req.body[field]) : null;
      }
    }

    if (Object.keys(metricUpdates).length > 0) {
      const { error: upsertError } = await supabase
        .from('metrics')
        .upsert({ post_id: id, manually_edited: true, ...metricUpdates }, { onConflict: 'post_id' });

      if (upsertError) {
        console.error('Admin metrics upsert error:', upsertError.message);
        return res.status(500).json({ error: 'Failed to update metrics' });
      }
    }

    // Return updated metrics + the applied post-level changes
    const { data: updatedMetrics } = await supabase
      .from('metrics')
      .select('*')
      .eq('post_id', id)
      .maybeSingle();

    return res.json({ metrics: updatedMetrics, post: postUpdates });
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
// GET /admin/ai-status — checks which AI model is configured and whether the
// Anthropic API key/model actually work (live ping, admin-only)
// ---------------------------------------------------------------------------
router.get('/ai-status', async (req, res, next) => {
  try {
    const result = await ai.pingModel();
    return res.json(result);
  } catch (err) {
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
// POST /admin/users — create a new user with the default password
// ---------------------------------------------------------------------------
router.post('/users', async (req, res, next) => {
  try {
    const rawUsername = (req.body.username || '').trim().toLowerCase();
    const displayName = (req.body.display_name || '').trim() || rawUsername;
    const role = req.body.role === 'admin' ? 'admin' : 'influencer';

    if (!rawUsername) {
      return res.status(400).json({ error: 'O nome de usuário é obrigatório' });
    }
    if (!/^[a-z0-9._-]+$/.test(rawUsername)) {
      return res.status(400).json({
        error: 'Use apenas letras minúsculas, números, ponto, hífen ou underline (sem espaços)',
      });
    }

    // Ensure the username is unique
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', rawUsername)
      .maybeSingle();

    if (checkError) {
      console.error('Create user check error:', checkError.message);
      return res.status(500).json({ error: 'Failed to verify username' });
    }
    if (existing) {
      return res.status(409).json({ error: `Já existe um usuário "${rawUsername}"` });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({
        username: rawUsername,
        display_name: displayName,
        password_hash: passwordHash,
        role,
        must_change_password: true,
        is_active: true,
      })
      .select('id, username, display_name, role, is_active, last_login, created_at')
      .single();

    if (insertError) {
      console.error('Create user insert error:', insertError.message);
      return res.status(500).json({ error: 'Falha ao criar o usuário' });
    }

    return res.status(201).json({ user: created, default_password: DEFAULT_PASSWORD });
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
