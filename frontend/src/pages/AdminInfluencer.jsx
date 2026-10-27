import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import NexLineChart from '../components/Charts/LineChart.jsx';
import BarComparison from '../components/Charts/BarComparison.jsx';
import YearView from '../components/Charts/YearView.jsx';
import { CHART_COLORS } from '../components/Charts/theme.jsx';
import PostDetailModal from '../components/PostDetailModal.jsx';
import { summaryFromAgg, toChartSeries, flattenPosts } from '../utils/normalize.js';
import {
  FormatBadge, DuplicateBadge, MetricCell, PostLink, PlatformLabel, PostThumb,
} from '../components/PostBadges.jsx';
import {
  IconDocument, IconSignal, IconEye, IconHeart, IconRefresh, IconTrash, IconImage,
} from '../components/Icons.jsx';
import {
  PageHeader, SectionHeader, Segmented, MonthSelect, YearSelect, EmptyState, Skeleton, Avatar, Spinner,
} from '../components/ui.jsx';
import { MONTHS, currentMonth, currentYear, formatCompact, formatDate, platformLabel } from '../utils/format.js';
import styles from './AdminInfluencer.module.css';

const COMPARE_METRICS = [
  { key: 'impressions', label: 'Visualizações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'reach', label: 'Alcance' },
];

export default function AdminInfluencer() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlYear = parseInt(searchParams.get('year'), 10);
  const urlMonth = parseInt(searchParams.get('month'), 10);

  const [month, setMonthState] = useState(urlMonth >= 1 && urlMonth <= 12 ? urlMonth : currentMonth());
  const [year, setYearState] = useState(!isNaN(urlYear) ? urlYear : currentYear());

  // Keep the URL in sync so the chosen month/year survives navigation
  // (e.g. back to Visão Geral and into another influencer) instead of
  // always resetting to the current month.
  const setMonth = (m) => {
    setMonthState(m);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('month', String(m));
      next.set('year', String(year));
      return next;
    });
  };
  const setYear = (y) => {
    setYearState(y);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('year', String(y));
      next.set('month', String(month));
      return next;
    });
  };
  const [tab, setTab] = useState('month');

  const [influencer, setInfluencer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [compare, setCompare] = useState(null);
  const [yearData, setYearData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [reprocessingId, setReprocessingId] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { month, year };
      const res = await api.get(`/admin/influencers/${id}/dashboard`, { params });
      const data = res.data;
      setInfluencer(data.influencer || null);
      setSummary(data.summary || null);
      setHistory(toChartSeries(data.history));
      setCompare(data.summary || null);
      setYearData(toChartSeries(data.year_data));
      setPosts(flattenPosts(data.posts));
    } catch {
      setError('Erro ao carregar dados do influenciador.');
    } finally {
      setLoading(false);
    }
  }, [id, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeletePost = async (post) => {
    if (!window.confirm(`Confirmar exclusão do post "${post.title || 'post'}"?`)) return;
    try {
      await api.delete(`/admin/posts/${post.id}`);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setSelectedPost((p) => (p?.id === post.id ? null : p));
    } catch {
      alert('Erro ao excluir post.');
    }
  };

  const handleReprocess = async (post) => {
    setReprocessingId(post.id);
    try {
      const res = await api.post(`/admin/posts/${post.id}/reprocess`, {}, { timeout: 120000 });
      if (res.data?.skipped) {
        alert('As métricas deste post foram editadas manualmente e não foram sobrescritas.');
      }
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao reprocessar as métricas deste post.');
    } finally {
      setReprocessingId(null);
    }
  };

  // Reprocessa todos os posts deste influenciador no mês exibido.
  const handleReprocessMonth = async () => {
    if (posts.length === 0) return;
    if (!window.confirm(`Reprocessar os ${posts.length} post(s) deste mês? A IA será executada novamente sobre os prints.`)) return;
    setBulkProgress({ done: 0, total: posts.length });
    for (let i = 0; i < posts.length; i++) {
      try {
        await api.post(`/admin/posts/${posts[i].id}/reprocess`, {}, { timeout: 120000 });
      } catch {
        // continua mesmo se um falhar
      }
      setBulkProgress({ done: i + 1, total: posts.length });
    }
    setBulkProgress(null);
    await fetchData();
  };

  const cur = summaryFromAgg(summary?.current);
  const prev = summaryFromAgg(summary?.previous);

  const platforms = [...new Set(posts.map((p) => p.platform).filter(Boolean))];
  const name = influencer?.display_name || influencer?.username || 'Influenciador';
  const backTo = `/admin?year=${year}&month=${month}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Visão geral', to: backTo }, { label: loading && !influencer ? '…' : name }]}
        title={(
          <span className={styles.titleRow}>
            {loading && !influencer ? (
              <span className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />
            ) : (
              <Avatar src={influencer?.avatar_url} name={name} size={52} variant="accent" />
            )}
            <span className={styles.titleText}>
              <span>{loading && !influencer ? 'Carregando…' : name}</span>
              <span className={styles.titleMeta}>
                {influencer?.username && <span>@{influencer.username}</span>}
                {platforms.map((p) => (
                  <span key={p} className={`platform-label platform-${p}`} style={{ fontSize: 12 }}>{platformLabel(p)}</span>
                ))}
              </span>
            </span>
          </span>
        )}
        actions={(
          <>
            <MonthSelect value={month} onChange={setMonth} style={{ width: 'auto' }} />
            <YearSelect value={year} onChange={setYear} style={{ width: 'auto' }} />
          </>
        )}
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid">
        {loading ? (
          <><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /></>
        ) : (
          <>
            <MetricCard label="Visualizações" value={cur.total_impressions} icon={<IconEye size={16} />} previousValue={prev.total_impressions} highlight />
            <MetricCard label="Curtidas" value={cur.total_likes} icon={<IconHeart size={16} />} previousValue={prev.total_likes} highlight />
            <MetricCard label="Posts" value={cur.total_posts} unit="raw" icon={<IconDocument size={16} />} previousValue={prev.total_posts} />
            <MetricCard label="Alcance" value={cur.total_reach} icon={<IconSignal size={16} />} previousValue={prev.total_reach} />
          </>
        )}
      </div>

      <section className="section">
        <SectionHeader
          title="Evolução"
          hint={tab === 'month' ? 'Últimos 12 meses e comparativo com o mês anterior' : `Mês a mês em ${year}`}
          actions={(
            <Segmented
              ariaLabel="Período dos gráficos"
              value={tab}
              onChange={setTab}
              options={[{ value: 'month', label: 'Mensal' }, { value: 'year', label: 'Anual' }]}
            />
          )}
        />
        {loading ? (
          <Skeleton height={340} />
        ) : tab === 'month' ? (
          <div className="grid-2">
            <NexLineChart
              data={history}
              xKey="month"
              title="Visualizações e alcance"
              subtitle="Últimos 12 meses"
              lines={[
                { key: 'impressions', name: 'Visualizações', color: CHART_COLORS.primary },
                { key: 'reach', name: 'Alcance', color: CHART_COLORS.accent },
              ]}
            />
            <BarComparison
              currentData={compare?.current || {}}
              previousData={compare?.previous || {}}
              metrics={COMPARE_METRICS}
            />
          </div>
        ) : (
          <YearView data={yearData} year={year} />
        )}
      </section>

      <section className="section">
        <SectionHeader
          title="Posts do período"
          hint={loading ? undefined : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} em ${MONTHS[month - 1]}/${year}`}
          actions={posts.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleReprocessMonth}
              disabled={!!bulkProgress || !!reprocessingId}
              title="Re-executa a IA sobre os prints de todos os posts deste mês"
            >
              {bulkProgress
                ? <><Spinner size={13} /> Reprocessando {bulkProgress.done}/{bulkProgress.total}…</>
                : <><IconRefresh size={13} /> Reprocessar métricas do mês</>}
            </button>
          )}
        />
        {loading ? (
          <Skeleton height={220} />
        ) : posts.length === 0 ? (
          <EmptyState
            bordered
            icon={<IconImage size={20} />}
            title="Nenhum post neste período"
            text="Escolha outro mês no seletor acima."
          />
        ) : (
          <AdminPostList
            posts={posts}
            onView={setSelectedPost}
            onDelete={handleDeletePost}
            onReprocess={handleReprocess}
            reprocessingId={reprocessingId}
            bulkBusy={!!bulkProgress}
          />
        )}
      </section>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
}

function AdminPostList({ posts, onView, onDelete, onReprocess, reprocessingId, bulkBusy }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Post</th>
            <th className="hide-sm">Plataforma</th>
            <th>Formato</th>
            <th className="hide-sm">Data</th>
            <th className="num">Visualizações</th>
            <th className="num">Curtidas</th>
            <th className="num"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="clickable" onClick={() => onView(post)}>
              <td>
                <div className="post-cell">
                  <PostThumb src={post.image_url} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span className="cell-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {post.title || 'Sem título'}
                      <PostLink url={post.post_url} />
                    </span>
                    {post.possible_duplicate && <span><DuplicateBadge /></span>}
                  </div>
                </div>
              </td>
              <td className="hide-sm"><PlatformLabel platform={post.platform} /></td>
              <td><FormatBadge type={post.post_type} /></td>
              <td className="hide-sm muted nowrap">{formatDate(post.published_date || post.created_at)}</td>
              <td className="num strong"><MetricCell value={post.impressions} format={formatCompact} /></td>
              <td className="num"><MetricCell value={post.likes} format={formatCompact} /></td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="cell-actions">
                  <button
                    type="button"
                    className="btn-icon btn"
                    onClick={() => onView(post)}
                    title="Ver prints e métricas"
                    aria-label="Ver prints e métricas"
                  >
                    <IconEye size={15} />
                  </button>
                  {onReprocess && (
                    <button
                      type="button"
                      className="btn-icon btn"
                      onClick={() => onReprocess(post)}
                      disabled={reprocessingId === post.id || bulkBusy}
                      title="Re-extrair métricas com IA"
                      aria-label="Re-extrair métricas com IA"
                    >
                      {reprocessingId === post.id ? <Spinner size={14} /> : <IconRefresh size={15} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-icon btn danger"
                    onClick={() => onDelete(post)}
                    title="Excluir post"
                    aria-label="Excluir post"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
