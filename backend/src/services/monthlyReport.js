'use strict';

const supabase = require('../db/supabase');
const metricsService = require('./metrics');

// ---------------------------------------------------------------------------
// Rule-based insight generation: numeric comparisons only, no AI involved —
// zero extra cost, fast and always consistent.
// ---------------------------------------------------------------------------

const METRIC_LABELS = {
  reach: 'Alcance',
  impressions: 'Visualizações',
  likes: 'Curtidas',
  comments: 'Comentários',
  shares: 'Compartilhamentos',
  saves: 'Salvamentos',
  post_count: 'Posts publicados',
};

const STABLE_THRESHOLD = 5; // % change below this is considered "estável"
const STRONG_THRESHOLD = 20; // % change above this is considered "forte"

function formatPct(pct) {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

/**
 * Builds a short list of human-readable insight sentences for one
 * influencer, comparing the target month against the immediately
 * previous month.
 */
function buildInsights({ current, previous, variation, feedCount, storyCount, prevFeedCount, prevStoryCount }) {
  const insights = [];

  if (!previous || !current) {
    insights.push('Sem dados do mês anterior para comparação — este é o primeiro mês com posts registrados.');
    return { insights, verdict: 'novo' };
  }

  const trackedFields = ['reach', 'likes', 'impressions', 'post_count'];
  let improved = 0;
  let worsened = 0;

  for (const field of trackedFields) {
    const pct = variation ? variation[field] : null;
    if (pct == null) continue;
    if (Math.abs(pct) < STABLE_THRESHOLD) continue;
    if (pct > 0) improved += 1;
    else worsened += 1;

    const label = METRIC_LABELS[field];
    const direction = pct > 0 ? 'subiu' : 'caiu';
    const intensity = Math.abs(pct) >= STRONG_THRESHOLD ? ' fortemente' : '';
    insights.push(`${label} ${direction}${intensity} ${formatPct(pct)} em relação ao mês anterior.`);
  }

  // Feed vs. story mix shift
  const feedDelta = feedCount - prevFeedCount;
  const storyDelta = storyCount - prevStoryCount;
  if (feedDelta !== 0) {
    insights.push(`Publicou ${Math.abs(feedDelta)} post${Math.abs(feedDelta) !== 1 ? 's' : ''} de feed a ${feedDelta > 0 ? 'mais' : 'menos'} que no mês anterior.`);
  }
  if (storyDelta !== 0) {
    insights.push(`Publicou ${Math.abs(storyDelta)} stor${Math.abs(storyDelta) !== 1 ? 'ies' : 'y'} a ${storyDelta > 0 ? 'mais' : 'menos'} que no mês anterior.`);
  }

  if (insights.length === 0) {
    insights.push('Resultados estáveis, sem variações relevantes em relação ao mês anterior.');
  }

  let verdict = 'misto';
  if (improved > 0 && worsened === 0) verdict = 'melhora';
  else if (worsened > 0 && improved === 0) verdict = 'queda';
  else if (improved === 0 && worsened === 0) verdict = 'estavel';

  return { insights, verdict };
}

/**
 * Builds the full monthly performance report for every active influencer,
 * for the complete calendar month immediately before `refDate`.
 */
async function buildMonthlyReport(refDate = new Date()) {
  let year = refDate.getFullYear();
  let month = refDate.getMonth(); // JS months are 0-indexed, so this is already "last month" (1-indexed)
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const { data: influencers, error } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('role', 'influencer')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) throw new Error(error.message);

  const { start: curStart, end: curEnd } = metricsService.monthRange(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = metricsService.monthRange(prevYear, prevMonth);

  const [curTypeCounts, prevTypeCounts] = await Promise.all([
    metricsService.countPostTypesByUser(curStart, curEnd),
    metricsService.countPostTypesByUser(prevStart, prevEnd),
  ]);

  // Trend window: target month + 3 months before it, anchored to the report's
  // own period rather than "today" (getMonthlyHistory anchors to "today",
  // which would pull in a partial in-progress month here).
  const trendMonths = [];
  for (let i = 3; i >= 0; i--) {
    let y = year;
    let m = month - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    trendMonths.push({ year: y, month: m });
  }

  const influencerReports = [];

  for (const inf of influencers || []) {
    const summary = await metricsService.getMonthlySummary(inf.id, year, month);

    const trend = await Promise.all(
      trendMonths.map(async ({ year: ty, month: tm }) => {
        const { start, end } = metricsService.monthRange(ty, tm);
        const metrics = await metricsService.fetchAggregatedForRange(inf.id, start, end);
        return { year: ty, month: tm, metrics };
      })
    );

    const feedCount = curTypeCounts[inf.id]?.feed || 0;
    const storyCount = curTypeCounts[inf.id]?.story || 0;
    const prevFeedCount = prevTypeCounts[inf.id]?.feed || 0;
    const prevStoryCount = prevTypeCounts[inf.id]?.story || 0;

    if (!summary.current) {
      // No posts at all this month — still list the influencer with a note.
      influencerReports.push({
        id: inf.id,
        name: inf.display_name || inf.username,
        hasData: false,
        feedCount: 0,
        storyCount: 0,
        current: null,
        previous: summary.previous,
        variation: null,
        trend,
        insights: ['Nenhum post registrado neste mês.'],
        verdict: 'sem_posts',
      });
      continue;
    }

    const { insights, verdict } = buildInsights({
      current: summary.current,
      previous: summary.previous,
      variation: summary.variation,
      feedCount,
      storyCount,
      prevFeedCount,
      prevStoryCount,
    });

    influencerReports.push({
      id: inf.id,
      name: inf.display_name || inf.username,
      hasData: true,
      feedCount,
      storyCount,
      current: summary.current,
      previous: summary.previous,
      variation: summary.variation,
      trend,
      insights,
      verdict,
    });
  }

  return {
    year,
    month,
    generatedAt: new Date().toISOString(),
    influencers: influencerReports,
  };
}

module.exports = { buildMonthlyReport, METRIC_LABELS };
