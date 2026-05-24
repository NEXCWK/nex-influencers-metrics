'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');
const metricsService = require('../services/metrics');

const router = express.Router();

// All metrics routes require authentication
router.use(authenticate);

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
// GET /metrics/summary
// Query: ?year=&month=   (defaults to current month)
// Returns monthly summary with variation vs previous month.
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);
    const summary = await metricsService.getMonthlySummary(req.user.id, year, month);
    return res.json({ year, month, ...summary });
  } catch (err) {
    console.error('GET /metrics/summary error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /metrics/history
// Query: ?months=12
// Returns last N months of aggregated metrics.
// ---------------------------------------------------------------------------
router.get('/history', async (req, res, next) => {
  try {
    const months = req.query.months ? parseInt(req.query.months, 10) : 12;

    if (isNaN(months) || months < 1 || months > 60) {
      return res.status(400).json({ error: 'months must be a number between 1 and 60' });
    }

    const history = await metricsService.getMonthlyHistory(req.user.id, months);
    return res.json({ history });
  } catch (err) {
    console.error('GET /metrics/history error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /metrics/compare
// Query: ?year=&month=   (defaults to current month)
// Returns current month vs previous month.
// ---------------------------------------------------------------------------
router.get('/compare', async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);
    const comparison = await metricsService.getMonthComparison(req.user.id, year, month);
    return res.json({ year, month, ...comparison });
  } catch (err) {
    console.error('GET /metrics/compare error:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /metrics/year/:year
// Returns all 12 months of a year (null for months with no data).
// ---------------------------------------------------------------------------
router.get('/year/:year', async (req, res, next) => {
  try {
    const year = parseInt(req.params.year, 10);

    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const yearView = await metricsService.getYearView(req.user.id, year);
    return res.json({ year, months: yearView });
  } catch (err) {
    console.error('GET /metrics/year/:year error:', err.message);
    next(err);
  }
});

module.exports = router;
