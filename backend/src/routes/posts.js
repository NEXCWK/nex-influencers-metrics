'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const storage = require('../services/storage');
const ai = require('../services/ai');

const router = express.Router();

// All posts routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Upload rate limiter: 80 uploads per user per hour
// (raised from 10, then 30 — still too tight for a bulk catch-up session
// uploading many posts back to back; still bounds runaway AI-extraction
// cost per user.)
// ---------------------------------------------------------------------------
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 80,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. You can upload at most 80 screenshots per hour.' },
});

// ---------------------------------------------------------------------------
// Multer: memory storage, 10 MB limit, images only
// ---------------------------------------------------------------------------
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
    }
  },
});

// ---------------------------------------------------------------------------
// Helper: derive file extension from MIME type
// ---------------------------------------------------------------------------
function extFromMime(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
}

// ---------------------------------------------------------------------------
// Helper: attach signed image URLs to a list of posts
// ---------------------------------------------------------------------------
async function attachSignedUrls(posts) {
  return Promise.all(
    posts.map(async (post) => {
      const signedUrl = post.image_url
        ? await storage.getSignedUrl(post.image_url)
        : null;
      return { ...post, signed_image_url: signedUrl };
    })
  );
}

// ---------------------------------------------------------------------------
// GET /posts — list the authenticated user's posts with metrics
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { year, month } = req.query;

    const metricsCols =
      'metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited, extra_metrics, created_at)';
    const idBase = 'id, title, platform, published_at, uploaded_at, image_url, confirmed_by_user, ai_raw_response';
    const fullSelect = `${idBase}, post_type, post_url, ${metricsCols}`;
    const noUrlSelect = `${idBase}, post_type, ${metricsCols}`;
    const baseSelect = `${idBase}, ${metricsCols}`;

    const build = (selectStr) => {
      let q = supabase
        .from('posts')
        .select(selectStr)
        .eq('user_id', req.user.id)
        .order('published_at', { ascending: false });

      if (year && month) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const start = `${y}-${String(m).padStart(2, '0')}-01`;
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        q = q.gte('published_at', start).lt('published_at', end);
      }
      return q;
    };

    let { data, error } = await build(fullSelect);

    // Graceful fallback: post_url (migration 005) or post_type (migration 003)
    // may not exist yet — degrade instead of failing the whole listing.
    if (error && /post_url/i.test(error.message)) {
      console.warn('post_url ausente — retry sem essa coluna.');
      ({ data, error } = await build(noUrlSelect));
    }
    if (error && /post_type/i.test(error.message)) {
      console.warn('post_type ausente — usando select base.');
      ({ data, error } = await build(baseSelect));
    }

    if (error) {
      console.error('Get posts DB error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }

    const postsWithUrls = await attachSignedUrls(data || []);
    return res.json({ posts: postsWithUrls });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /posts/upload — upload prints; EACH print becomes its own post.
// The AI classifies each print as feed or story from its visual layout and
// extracts that print's own metrics (no consolidation across prints — every
// print is treated as an independent post, matching how the influencer
// actually generates them, one screenshot per publication).
// ---------------------------------------------------------------------------
const ALLOWED_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'linkedin'];

const FORMAT_LABEL = { feed: 'Feed', story: 'Story' };

function autoTitle(postType, publishedDate) {
  const d = new Date(`${publishedDate}T12:00:00`);
  const label = FORMAT_LABEL[postType] || 'Post';
  const dateStr = isNaN(d) ? '' : ` — ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${label}${dateStr}`;
}

router.post(
  '/upload',
  uploadLimiter,
  upload.array('images', 10),
  async (req, res, next) => {
    try {
      // Validate file presence — one upload batch may include up to 10 prints,
      // each becoming its own post.
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'At least one image is required (field name: images)' });
      }
      if (files.length > 10) {
        return res.status(400).json({ error: 'You can upload at most 10 prints at once' });
      }

      const { published_at, platform } = req.body;

      if (!published_at) {
        return res.status(400).json({ error: 'published_at is required (YYYY-MM-DD)' });
      }
      if (!platform) {
        return res.status(400).json({ error: 'platform is required' });
      }
      if (!ALLOWED_PLATFORMS.includes(platform)) {
        return res
          .status(400)
          .json({ error: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}` });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(published_at)) {
        return res.status(400).json({ error: 'published_at must be in YYYY-MM-DD format' });
      }

      const userId = req.user.id;
      const publishedDate = new Date(published_at);
      const year = publishedDate.getUTCFullYear();
      const month = publishedDate.getUTCMonth() + 1;

      // 1. Classify + extract ALL prints in one AI call (cost-efficient),
      // each image treated as an independent post — never consolidated.
      let batchResults = null;
      let extractionFailed = false;
      let aiError = null;

      if (!process.env.ANTHROPIC_API_KEY) {
        extractionFailed = true;
        aiError = 'ANTHROPIC_API_KEY is not configured on the backend';
        console.error('AI extraction skipped:', aiError);
      } else {
        try {
          batchResults = await ai.classifyAndExtractBatch(
            files.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype }))
          );
        } catch (aiErr) {
          console.error('AI batch classify/extract error:', aiErr.message);
          extractionFailed = true;
          aiError = aiErr.message;
        }
      }

      const metricFields = [
        'reach', 'impressions', 'likes', 'comments', 'shares',
        'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks',
      ];

      // 2. Create one post per print, upload its single image, store the AI
      // result for that print. Done sequentially per post (not all prints in
      // parallel) so a storage failure on print N only orphans that one post.
      const createdPosts = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const aiResult = batchResults ? batchResults[i] : null;
        const post_type = aiResult?.post_type === 'story' ? 'story' : 'feed';
        const postId = uuidv4();

        const postRecord = {
          id: postId,
          user_id: userId,
          title: autoTitle(post_type, published_at),
          platform,
          post_type,
          published_at,
          confirmed_by_user: false,
        };

        let { error: insertError } = await supabase.from('posts').insert(postRecord);

        // Graceful fallback if post_type column doesn't exist yet.
        if (insertError && /post_type/i.test(insertError.message)) {
          console.warn('post_type column missing — retrying insert without it.');
          const { post_type: _dropped, ...withoutType } = postRecord;
          const retry = await supabase.from('posts').insert(withoutType);
          insertError = retry.error;
        }

        if (insertError) {
          console.error('Post insert error:', insertError.message);
          continue; // skip this print, keep processing the rest of the batch
        }

        let imagePath;
        try {
          imagePath = await storage.uploadImage(f.buffer, f.mimetype, userId, postId, year, month, extFromMime(f.mimetype), 0);
        } catch (uploadErr) {
          await supabase.from('posts').delete().eq('id', postId);
          console.error('Storage upload error:', uploadErr.message);
          continue;
        }

        await supabase.from('posts').update({ image_url: imagePath }).eq('id', postId);

        if (aiResult) {
          const { error: rawSaveErr } = await supabase
            .from('posts')
            .update({ ai_raw_response: aiResult })
            .eq('id', postId);
          if (rawSaveErr && !/ai_raw_response/i.test(rawSaveErr.message)) {
            console.warn('ai_raw_response update warning:', rawSaveErr.message);
          }
        }

        const allNull = extractionFailed || !aiResult || metricFields.every((f2) => aiResult[f2] == null);

        createdPosts.push({
          post_id: postId,
          print_index: i, // lets the client show the matching print while confirming
          title: postRecord.title,
          post_type,
          metrics_extracted: extractionFailed ? null : aiResult,
          confidence: aiResult ? aiResult.confidence : null,
          notes: aiResult ? aiResult.notes : null,
          needs_manual_entry: allNull,
        });
      }

      if (createdPosts.length === 0) {
        return res.status(500).json({ error: 'Failed to create any post from this batch' });
      }

      return res.status(201).json({
        posts: createdPosts,
        ai_error: aiError,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /posts/:id/confirm — confirm / save final metrics for a post
// ---------------------------------------------------------------------------
router.post('/:id/confirm', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify post exists and belongs to this user
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, user_id, platform')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Confirm post fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      reach,
      impressions,
      likes,
      comments,
      shares,
      saves,
      plays,
      engagement_rate,
      profile_visits,
      link_clicks,
      manually_edited,
      extra_metrics,
      acknowledge_duplicate,
    } = req.body;

    // --- Proteção contra post duplicado ---
    // Métrica-chave: visualizações (impressions); para story, cai no alcance.
    // Compara com outros posts do MESMO influenciador na MESMA plataforma.
    const keyValue = (impressions ?? reach) ?? null;
    if (keyValue != null && acknowledge_duplicate !== true) {
      const { data: siblings } = await supabase
        .from('posts')
        .select('id, title, published_at, metrics(reach, impressions)')
        .eq('user_id', post.user_id)
        .eq('platform', post.platform)
        .neq('id', id);

      const dup = (siblings || []).find((s) => {
        const m = Array.isArray(s.metrics) ? s.metrics[0] : s.metrics;
        if (!m) return false;
        const sVal = (m.impressions ?? m.reach) ?? null;
        return sVal != null && Number(sVal) === Number(keyValue);
      });

      if (dup) {
        return res.status(409).json({
          duplicate: true,
          key_value: keyValue,
          existing: { title: dup.title || null, published_at: dup.published_at || null },
        });
      }
    }

    // Upsert metrics (insert or update if already exists for this post)
    const metricsPayload = {
      post_id: id,
      reach: reach ?? null,
      impressions: impressions ?? null,
      likes: likes ?? null,
      comments: comments ?? null,
      shares: shares ?? null,
      saves: saves ?? null,
      plays: plays ?? null,
      engagement_rate: engagement_rate ?? null,
      profile_visits: profile_visits ?? null,
      link_clicks: link_clicks ?? null,
      manually_edited: manually_edited === true,
      ...(extra_metrics != null ? { extra_metrics } : {}),
    };

    let { error: upsertError } = await supabase
      .from('metrics')
      .upsert(metricsPayload, { onConflict: 'post_id' });

    // Graceful fallback: if extra_metrics column does not exist yet, retry without it.
    // Fix: run  ALTER TABLE metrics ADD COLUMN IF NOT EXISTS extra_metrics jsonb;
    if (upsertError && /extra_metrics/i.test(upsertError.message)) {
      console.warn('extra_metrics column missing — retrying without it.');
      const { extra_metrics: _dropped, ...payloadWithout } = metricsPayload;
      const fallbackResult = await supabase
        .from('metrics')
        .upsert(payloadWithout, { onConflict: 'post_id' });
      upsertError = fallbackResult.error;
    }

    if (upsertError) {
      console.error('Metrics upsert error:', upsertError.message);
      return res.status(500).json({ error: 'Failed to save metrics' });
    }

    // Mark post as confirmed (and flag as possible duplicate if the user
    // acknowledged the warning and uploaded anyway).
    const confirmPayload = { confirmed_by_user: true };
    if (acknowledge_duplicate === true) confirmPayload.possible_duplicate = true;

    let { error: updateError } = await supabase
      .from('posts')
      .update(confirmPayload)
      .eq('id', id);

    // Graceful fallback if possible_duplicate column doesn't exist yet.
    if (updateError && /possible_duplicate/i.test(updateError.message)) {
      console.warn('possible_duplicate column missing — confirming without the flag.');
      updateError = (await supabase
        .from('posts')
        .update({ confirmed_by_user: true })
        .eq('id', id)).error;
    }

    if (updateError) {
      console.error('Post confirm update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to confirm post' });
    }

    // Return updated post + metrics
    const { data: updatedPost, error: refetchError } = await supabase
      .from('posts')
      .select(
        `id, title, platform, published_at, uploaded_at, image_url, confirmed_by_user,
         metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited, extra_metrics, created_at)`
      )
      .eq('id', id)
      .single();

    if (refetchError) {
      return res.status(500).json({ error: 'Failed to refetch post' });
    }

    const signedUrl = updatedPost.image_url
      ? await storage.getSignedUrl(updatedPost.image_url)
      : null;

    return res.json({ post: { ...updatedPost, signed_image_url: signedUrl } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /posts/:id — delete own post, its metrics, and its storage image
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify post belongs to user
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, user_id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Delete post fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete metrics first (FK constraint)
    await supabase.from('metrics').delete().eq('post_id', id);

    // Delete post record
    const { error: deleteError } = await supabase.from('posts').delete().eq('id', id);
    if (deleteError) {
      console.error('Post delete DB error:', deleteError.message);
      return res.status(500).json({ error: 'Failed to delete post' });
    }

    // Delete from storage (best effort — don't fail the request if this fails)
    if (post.image_url) {
      try {
        await storage.deleteImage(post.image_url);
      } catch (storageErr) {
        console.error('Storage delete error (non-fatal):', storageErr.message);
      }
    }

    return res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /posts/:id — owner edits their own post's date/month, title and metrics
// (without deleting and re-uploading). Changing published_at moves the post to
// another month on the dashboards.
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Patch post fetch error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // --- Post-level fields: date/month, title, type ---
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
        console.error('Patch post update error:', postErr.message);
        return res.status(500).json({ error: 'Falha ao atualizar os dados do post' });
      }
    }

    // --- Metric fields (only touch metrics when at least one was sent) ---
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
        console.error('Patch metrics upsert error:', upsertError.message);
        return res.status(500).json({ error: 'Failed to update metrics' });
      }
    }

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
// Multer error handler (file too large / wrong type)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.includes('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
