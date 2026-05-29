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
// Upload rate limiter: 10 uploads per user per hour
// ---------------------------------------------------------------------------
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. You can upload at most 10 screenshots per hour.' },
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

    let query = supabase
      .from('posts')
      .select(
        `id, title, platform, published_at, uploaded_at, image_url, confirmed_by_user, ai_raw_response,
         metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited, created_at)`
      )
      .eq('user_id', req.user.id)
      .order('published_at', { ascending: false });

    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
      query = query.gte('published_at', start).lt('published_at', end);
    }

    const { data, error } = await query;
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
// POST /posts/upload — upload a screenshot and extract metrics via AI
// ---------------------------------------------------------------------------
const ALLOWED_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'linkedin'];

router.post(
  '/upload',
  uploadLimiter,
  upload.array('images', 10),
  async (req, res, next) => {
    try {
      // Validate file presence — one post may include up to 10 prints
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'At least one image is required (field name: images)' });
      }
      if (files.length > 10) {
        return res.status(400).json({ error: 'A post can have at most 10 prints' });
      }

      const { title, published_at, platform } = req.body;

      // Validate required fields
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }
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

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(published_at)) {
        return res.status(400).json({ error: 'published_at must be in YYYY-MM-DD format' });
      }

      const postId = uuidv4();
      const userId = req.user.id;
      const publishedDate = new Date(published_at);
      const year = publishedDate.getUTCFullYear();
      const month = publishedDate.getUTCMonth() + 1;

      // 1. Create post record (without image_url yet)
      const { error: insertError } = await supabase.from('posts').insert({
        id: postId,
        user_id: userId,
        title: title.trim(),
        platform,
        published_at,
        confirmed_by_user: false,
      });

      if (insertError) {
        console.error('Post insert error:', insertError.message);
        return res.status(500).json({ error: 'Failed to create post record' });
      }

      // 2. Upload every print to Supabase Storage (grouped under the post folder)
      const imagePaths = [];
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const path = await storage.uploadImage(
            f.buffer,
            f.mimetype,
            userId,
            postId,
            year,
            month,
            extFromMime(f.mimetype),
            i
          );
          imagePaths.push(path);
        }
      } catch (uploadErr) {
        // Clean up orphaned post on upload failure
        await supabase.from('posts').delete().eq('id', postId);
        console.error('Storage upload error:', uploadErr.message);
        return res.status(500).json({ error: `Failed to upload images: ${uploadErr.message}` });
      }

      // 3. Update post with the primary print path (first print = thumbnail)
      await supabase
        .from('posts')
        .update({ image_url: imagePaths[0] })
        .eq('id', postId);

      // 4. Extract & consolidate metrics from ALL prints with Claude AI
      let aiResult = null;
      let extractionFailed = false;
      let aiError = null;

      if (!process.env.ANTHROPIC_API_KEY) {
        extractionFailed = true;
        aiError = 'ANTHROPIC_API_KEY is not configured on the backend';
        console.error('AI extraction skipped:', aiError);
      } else {
        try {
          aiResult = await ai.extractMetricsFromImages(
            files.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype }))
          );

          // Store raw AI response on the post
          await supabase
            .from('posts')
            .update({ ai_raw_response: aiResult })
            .eq('id', postId);
        } catch (aiErr) {
          console.error('AI extraction error:', aiErr.message);
          extractionFailed = true;
          aiError = aiErr.message;
        }
      }

      // 5. Determine if all metric fields are null (needs manual entry)
      const metricFields = [
        'reach', 'impressions', 'likes', 'comments', 'shares',
        'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks',
      ];

      const allNull =
        extractionFailed ||
        !aiResult ||
        metricFields.every((f) => aiResult[f] == null);

      return res.status(201).json({
        post_id: postId,
        metrics_extracted: extractionFailed ? null : aiResult,
        confidence: aiResult ? aiResult.confidence : null,
        notes: aiResult ? aiResult.notes : null,
        needs_manual_entry: allNull,
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
      .select('id, user_id')
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
    } = req.body;

    // Upsert metrics (insert or update if already exists for this post)
    const { error: upsertError } = await supabase.from('metrics').upsert(
      {
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
        extra_metrics: extra_metrics || null,
      },
      { onConflict: 'post_id' }
    );

    if (upsertError) {
      console.error('Metrics upsert error:', upsertError.message);
      return res.status(500).json({ error: 'Failed to save metrics' });
    }

    // Mark post as confirmed
    const { error: updateError } = await supabase
      .from('posts')
      .update({ confirmed_by_user: true })
      .eq('id', id);

    if (updateError) {
      console.error('Post confirm update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to confirm post' });
    }

    // Return updated post + metrics
    const { data: updatedPost, error: refetchError } = await supabase
      .from('posts')
      .select(
        `id, title, platform, published_at, uploaded_at, image_url, confirmed_by_user,
         metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited, created_at)`
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
