// ---------------------------------------------------------------------------
// Normalizers: map the backend API response shapes into the flat structures
// the UI components expect. The backend returns nested objects
// ({ user, metrics }, { current, previous }, metrics as arrays, signed_image_url),
// while the table/chart/card components read flat fields.
// ---------------------------------------------------------------------------

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function monthLabel(m) {
  const idx = (Number(m) - 1) % 12;
  return MONTH_ABBR[idx] || String(m);
}

// Aggregated metrics object -> card-friendly summary fields.
export function summaryFromAgg(agg) {
  if (!agg) {
    return {
      total_posts: 0,
      total_reach: 0,
      total_impressions: 0,
      total_likes: 0,
      avg_engagement_rate: 0,
    };
  }
  return {
    total_posts: agg.post_count ?? 0,
    total_reach: agg.reach ?? 0,
    total_impressions: agg.impressions ?? 0,
    total_likes: agg.likes ?? 0,
    avg_engagement_rate: agg.engagement_rate ?? 0,
  };
}

// History / year-view array [{ year, month, metrics }] -> chart rows.
export function toChartSeries(arr) {
  return (Array.isArray(arr) ? arr : []).map((row) => ({
    month: monthLabel(row.month),
    reach: row.metrics?.reach ?? 0,
    engagement_rate: row.metrics?.engagement_rate ?? 0,
    likes: row.metrics?.likes ?? 0,
    impressions: row.metrics?.impressions ?? 0,
  }));
}

// A single post (metrics as array + signed url) -> flat fields for tables.
export function flattenPost(post) {
  if (!post) return {};
  const m = Array.isArray(post.metrics) ? (post.metrics[0] || {}) : (post.metrics || {});
  return {
    ...post,
    image_url: post.signed_image_url || post.image_url || null,
    published_date: post.published_at || post.uploaded_at || null,
    influencer_name: post.user?.display_name || post.user?.username || null,
    reach: m.reach ?? null,
    impressions: m.impressions ?? null,
    likes: m.likes ?? null,
    comments: m.comments ?? null,
    shares: m.shares ?? null,
    saves: m.saves ?? null,
    plays: m.plays ?? null,
    engagement_rate: m.engagement_rate ?? null,
    profile_visits: m.profile_visits ?? null,
    link_clicks: m.link_clicks ?? null,
  };
}

export function flattenPosts(posts) {
  return (Array.isArray(posts) ? posts : []).map(flattenPost);
}

// Admin influencer ranking [{ user, metrics }] -> flat ranking rows.
export function flattenRanking(ranking) {
  return (Array.isArray(ranking) ? ranking : []).map((r) => ({
    id: r.user?.id,
    username: r.user?.username,
    display_name: r.user?.display_name,
    posts_count: r.metrics?.post_count ?? 0,
    reach: r.metrics?.reach ?? 0,
    likes: r.metrics?.likes ?? 0,
    impressions: r.metrics?.impressions ?? 0,
    engagement_rate: r.metrics?.engagement_rate ?? null,
  }));
}
