import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import MetricCard from '../components/MetricCard.jsx';
import PostList from '../components/PostList.jsx';
import EditPostModal from '../components/EditPostModal.jsx';
import { IconDocument, IconSignal, IconEye, IconHeart, IconUpload } from '../components/Icons.jsx';
import NexLineChart from '../components/Charts/LineChart.jsx';
import BarComparison from '../components/Charts/BarComparison.jsx';
import YearView from '../components/Charts/YearView.jsx';
import { CHART_COLORS } from '../components/Charts/theme.jsx';
import MembersDirectory from '../components/MembersDirectory.jsx';
import { PageHeader, SectionHeader, Segmented, MonthSelect, YearSelect, Skeleton } from '../components/ui.jsx';
import { summaryFromAgg, toChartSeries, flattenPosts } from '../utils/normalize.js';
import { MONTHS, currentMonth, currentYear } from '../utils/format.js';

const COMPARE_METRICS = [
  { key: 'impressions', label: 'Visualizações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'reach', label: 'Alcance' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState('month'); // 'month' | 'year'

  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [compare, setCompare] = useState(null);
  const [yearData, setYearData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editPost, setEditPost] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, historyRes, compareRes, yearRes, postsRes] = await Promise.all([
        api.get('/metrics/summary', { params: { month, year } }),
        api.get('/metrics/history'),
        api.get('/metrics/compare', { params: { month, year } }),
        api.get(`/metrics/year/${year}`),
        api.get('/posts', { params: { month, year } }),
      ]);
      setSummary(summaryRes.data);
      setHistory(toChartSeries(historyRes.data?.history));
      setCompare(compareRes.data);
      setYearData(toChartSeries(yearRes.data?.months));
      setPosts(flattenPosts(postsRes.data?.posts));
    } catch (err) {
      setError('Erro ao carregar os dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Backend returns { current, previous, variation } with aggregated metric keys.
  const cur = summaryFromAgg(summary?.current);
  const prev = summaryFromAgg(summary?.previous);
  const firstName = (user?.display_name || user?.username || '').split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : 'Meu desempenho'}
        subtitle={`Resumo das suas publicações em ${MONTHS[month - 1].toLowerCase()} de ${year}.`}
        actions={(
          <>
            <MonthSelect value={month} onChange={setMonth} style={{ width: 'auto' }} />
            <YearSelect value={year} onChange={setYear} style={{ width: 'auto' }} />
            <Link to="/upload" className="btn btn-primary">
              <IconUpload size={15} /> Enviar posts
            </Link>
          </>
        )}
      />

      {error && <div className="alert alert-error">{error}</div>}

      {/* KPIs */}
      <div className="metrics-grid">
        {loading ? (
          <>
            <Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} />
          </>
        ) : (
          <>
            <MetricCard
              label="Visualizações"
              value={cur.total_impressions}
              icon={<IconEye size={16} />}
              previousValue={prev.total_impressions}
              highlight
            />
            <MetricCard
              label="Curtidas"
              value={cur.total_likes}
              icon={<IconHeart size={16} />}
              previousValue={prev.total_likes}
              highlight
            />
            <MetricCard
              label="Posts publicados"
              value={cur.total_posts}
              unit="raw"
              icon={<IconDocument size={16} />}
              previousValue={prev.total_posts}
            />
            <MetricCard
              label="Alcance"
              value={cur.total_reach}
              icon={<IconSignal size={16} />}
              previousValue={prev.total_reach}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <section className="section">
        <SectionHeader
          title="Evolução"
          hint={tab === 'month' ? 'Últimos 12 meses e comparativo com o mês anterior' : `Mês a mês em ${year}`}
          actions={(
            <Segmented
              ariaLabel="Período dos gráficos"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'month', label: 'Mensal' },
                { value: 'year', label: 'Anual' },
              ]}
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

      {/* Posts */}
      <section className="section">
        <SectionHeader
          title="Posts do período"
          hint={loading ? undefined : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} em ${MONTHS[month - 1]}/${year}`}
        />
        {loading ? (
          <Skeleton height={220} />
        ) : (
          <PostList
            posts={posts}
            onEdit={setEditPost}
            emptyAction={<Link to="/upload" className="btn btn-primary btn-sm"><IconUpload size={14} /> Enviar posts</Link>}
          />
        )}
      </section>

      {/* Community directory — active influencers (view-only) */}
      <section className="section">
        <SectionHeader title="Comunidade Nex" hint="Influenciadores parceiros ativos" />
        <MembersDirectory />
      </section>

      {editPost && (
        <EditPostModal
          post={editPost}
          endpoint={`/posts/${editPost.id}`}
          onSaved={() => { setEditPost(null); fetchData(); }}
          onClose={() => setEditPost(null)}
        />
      )}
    </>
  );
}
