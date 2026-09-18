'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const metricsRouter = require('./routes/metrics');
const adminRouter = require('./routes/admin');
const profileRouter = require('./routes/profile');
const membersRouter = require('./routes/members');
const couponsRouter = require('./routes/coupons');

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
// Keyed by IP, so everyone behind the same office/NAT gateway shares this
// budget. 100 req/15min was easily exhausted by normal multi-user traffic
// (dashboards polling + several people uploading posts at once) and could
// surface as unrelated-looking failures for other users on the same network.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
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
app.use('/profile', profileRouter);
app.use('/members', membersRouter);
app.use('/coupons', couponsRouter);

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

  // ---------------------------------------------------------------------------
  // Scheduled job: monthly performance report, day 5 of each month at 08:00
  // (America/Sao_Paulo), covering the complete previous calendar month.
  // Sending only actually happens once SMTP_* env vars are configured — until
  // then the report is still generated and stored for admin preview.
  // ---------------------------------------------------------------------------
  cron.schedule(
    '0 8 5 * *',
    async () => {
      console.log('Running scheduled monthly report job...');
      try {
        const { runMonthlyReportJob } = require('./jobs/monthlyReportJob');
        const { emailResult } = await runMonthlyReportJob();
        console.log('Monthly report job finished:', emailResult);
      } catch (err) {
        console.error('Monthly report job failed:', err.message);
      }
    },
    { timezone: 'America/Sao_Paulo' }
  );
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
