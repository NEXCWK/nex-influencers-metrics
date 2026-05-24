'use strict';

const supabase = require('../db/supabase');

// ---------------------------------------------------------------------------
// Helper: build a date range for a given year/month
// ---------------------------------------------------------------------------
function monthRange(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

// ---------------------------------------------------------------------------
// Helper: fetch aggregated metrics for one user over a date range
// Returns null when no posts exist for that range.
// ---------------------------------------------------------------------------
async function fetchAggregatedForRange(userId, rangeStart, rangeEnd) {
  // We need to join posts (for date/user filter) with metrics (for aggregation).
  // Supabase JS doesn't support aggregate functions natively via the client,
  // so we pull all metrics rows for the filtered posts and aggregate in JS.

  let postsQuery = supabase
    .from('posts')
    .select('id')
    .gte('published_at', rangeStart)
    .lt('published_at', rangeEnd);

  if (userId) {
    postsQuery = postsQuery.eq('user_id', userId);
  }

  const { data: posts, error: postsError } = await postsQuery;
  if (postsError) throw new Error(postsError.message);
  if (!posts || posts.length === 0) return null;

  const postIds = posts.map((p) => p.id);

  const { data: metricsRows, error: metricsError } = await supabase
    .from('metrics')
    .select(
      'reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks'
    )
    .in('post_id', postIds);

  if (metricsError) throw new Error(metricsError.message);
  if (!metricsRows || metricsRows.length === 0) return null;

  return aggregateMetricRows(metricsRows, posts.length);
}

function aggregateMetricRows(rows, postCount) {
  const sum = (field) =>
    rows.reduce((acc, r) => acc + (r[field] != null ? Number(r[field]) : 0), 0);

  const avg = (field) => {
    const vals = rows.filter((r) => r[field] != null).map((r) => Number(r[field]));
    if (vals.length === 0) return null;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  return {
    post_count: postCount,
    reach: sum('reach'),
    impressions: sum('impressions'),
    likes: sum('likes'),
    comments: sum('comments'),
    shares: sum('shares'),
    saves: sum('saves'),
    plays: sum('plays'),
    engagement_rate: avg('engagement_rate'),
    profile_visits: sum('profile_visits'),
    link_clicks: sum('link_clicks'),
  };
}

function calcVariation(current, previous) {
  if (!current || !previous) return null;
  const variation = {};
  const numericFields = [
    'reach', 'impressions', 'likes', 'comments', 'shares',
    'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks', 'post_count',
  ];
  for (const field of numericFields) {
    const cur = current[field];
    const prev = previous[field];
    if (cur == null || prev == null || prev === 0) {
      variation[field] = null;
    } else {
      variation[field] = parseFloat((((cur - prev) / prev) * 100).toFixed(2));
    }
  }
  return variation;
}

// ---------------------------------------------------------------------------
// getMonthlySummary
// ---------------------------------------------------------------------------
async function getMonthlySummary(userId, year, month) {
  const { start: curStart, end: curEnd } = monthRange(year, month);

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const { start: prevStart, end: prevEnd } = monthRange(prevYear, prevMonth);

  const [current, previous] = await Promise.all([
    fetchAggregatedForRange(userId, curStart, curEnd),
    fetchAggregatedForRange(userId, prevStart, prevEnd),
  ]);

  return {
    current,
    previous,
    variation: calcVariation(current, previous),
  };
}

// ---------------------------------------------------------------------------
// getMonthlyHistory
// ---------------------------------------------------------------------------
async function getMonthlyHistory(userId, months = 12) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const metrics = await fetchAggregatedForRange(userId, start, end);
    result.push({ year, month, metrics });
  }

  return result;
}

// ---------------------------------------------------------------------------
// getMonthComparison
// ---------------------------------------------------------------------------
async function getMonthComparison(userId, year, month) {
  return getMonthlySummary(userId, year, month);
}

// ---------------------------------------------------------------------------
// getYearView
// ---------------------------------------------------------------------------
async function getYearView(userId, year) {
  const result = [];

  for (let month = 1; month <= 12; month++) {
    const { start, end } = monthRange(year, month);
    const metrics = await fetchAggregatedForRange(userId, start, end);
    result.push({ year: parseInt(year, 10), month, metrics });
  }

  return result;
}

// ---------------------------------------------------------------------------
// getAdminOverview
// ---------------------------------------------------------------------------
async function getAdminOverview(year, month) {
  const { start, end } = monthRange(year, month);

  // Total posts and unique influencers this month
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, user_id')
    .gte('published_at', start)
    .lt('published_at', end);

  if (postsError) throw new Error(postsError.message);

  const totalPosts = posts ? posts.length : 0;
  const activeInfluencers = posts
    ? new Set(posts.map((p) => p.user_id)).size
    : 0;

  // Aggregate metrics across all posts this month
  const aggregate = posts && posts.length > 0
    ? await fetchAggregatedForRange(null, start, end)
    : null;

  return {
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    total_posts: totalPosts,
    active_influencers: activeInfluencers,
    aggregate,
  };
}

// ---------------------------------------------------------------------------
// getInfluencersRanking
// ---------------------------------------------------------------------------
async function getInfluencersRanking(year, month, sortBy = 'reach') {
  const { start, end } = monthRange(year, month);

  // Get all active influencers
  const { data: influencers, error: usersError } = await supabase
    .from('users')
    .select('id, username, display_name, role')
    .eq('is_active', true)
    .eq('role', 'influencer');

  if (usersError) throw new Error(usersError.message);

  const ranking = [];

  for (const influencer of influencers) {
    const data = await fetchAggregatedForRange(influencer.id, start, end);
    ranking.push({
      user: {
        id: influencer.id,
        username: influencer.username,
        display_name: influencer.display_name,
      },
      metrics: data,
    });
  }

  // Sort by the requested field (desc, nulls last)
  const validSortFields = [
    'reach', 'impressions', 'likes', 'comments', 'shares',
    'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks', 'post_count',
  ];
  const field = validSortFields.includes(sortBy) ? sortBy : 'reach';

  ranking.sort((a, b) => {
    const av = a.metrics ? (a.metrics[field] ?? -Infinity) : -Infinity;
    const bv = b.metrics ? (b.metrics[field] ?? -Infinity) : -Infinity;
    return bv - av;
  });

  return ranking;
}

// ---------------------------------------------------------------------------
// getAllPostsFiltered
// ---------------------------------------------------------------------------
async function getAllPostsFiltered({
  influencerId,
  year,
  month,
  platform,
  startDate,
  endDate,
  page = 1,
  pageSize = 20,
} = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('posts')
    .select(
      `id, title, platform, published_at, uploaded_at, image_url, confirmed_by_user, ai_raw_response,
       user:users!posts_user_id_fkey(id, username, display_name),
       metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited)`,
      { count: 'exact' }
    )
    .order('published_at', { ascending: false })
    .range(from, to);

  if (influencerId) query = query.eq('user_id', influencerId);
  if (platform) query = query.eq('platform', platform);

  if (year && month) {
    const { start, end } = monthRange(year, month);
    query = query.gte('published_at', start).lt('published_at', end);
  } else {
    if (startDate) query = query.gte('published_at', startDate);
    if (endDate) query = query.lte('published_at', endDate);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    posts: data || [],
    total: count || 0,
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10),
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

// ---------------------------------------------------------------------------
// exportPostsCSV (returns rows for CSV generation, no pagination)
// ---------------------------------------------------------------------------
async function exportPostsCSV({
  influencerId,
  year,
  month,
  platform,
  startDate,
  endDate,
} = {}) {
  let query = supabase
    .from('posts')
    .select(
      `id, title, platform, published_at, uploaded_at, confirmed_by_user,
       user:users!posts_user_id_fkey(id, username, display_name),
       metrics(reach, impressions, likes, comments, shares, saves, plays, engagement_rate, profile_visits, link_clicks, manually_edited)`
    )
    .order('published_at', { ascending: false });

  if (influencerId) query = query.eq('user_id', influencerId);
  if (platform) query = query.eq('platform', platform);

  if (year && month) {
    const { start, end } = monthRange(year, month);
    query = query.gte('published_at', start).lt('published_at', end);
  } else {
    if (startDate) query = query.gte('published_at', startDate);
    if (endDate) query = query.lte('published_at', endDate);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data || [];
}

module.exports = {
  getMonthlySummary,
  getMonthlyHistory,
  getMonthComparison,
  getYearView,
  getAdminOverview,
  getInfluencersRanking,
  getAllPostsFiltered,
  exportPostsCSV,
};
