'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const metricsRouter = require('./routes/metrics');
const adminRouter = require('./routes/admin');

const app = express();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const corsOrigin = process.env.FRONTEND_URL || '*';
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: corsOrigin !== '*',
  })
);

// ---------------------------------------------------------------------------
// Body parsing & logging
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Rate limiting — general
// ---------------------------------------------------------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// Health check (before auth-protected routes)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// Diagnostic: ensure + test Supabase Storage bucket access (internal use)
app.get('/health/storage', async (_req, res) => {
  try {
    const storage = require('./services/storage');
    const supabase = require('./db/supabase');
    const BUCKET = 'post-prints';

    // Create the bucket if it doesn't exist yet, then verify access.
    await storage.ensureBucket();

    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1 });
    if (error) {
      return res.status(500).json({ ok: false, bucket: BUCKET, error: error.message });
    }
    return res.json({ ok: true, bucket: BUCKET, listed: data?.length ?? 0 });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/auth', authRouter);
app.use('/posts', postsRouter);
app.use('/metrics', metricsRouter);
app.use('/admin', adminRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(status).json({ error: message });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  if (process.env.RUN_SEED === 'true') {
    console.log('RUN_SEED=true detected — running seed before starting server...');
    const seed = require('./db/seed');
    await seed();
  }

  app.listen(PORT, () => {
    console.log(`Nex Influencer Metrics API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (corsOrigin !== '*') {
      console.log(`CORS origin: ${corsOrigin}`);
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
