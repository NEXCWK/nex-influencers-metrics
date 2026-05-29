import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import PostList from '../components/PostList.jsx';
import { IconDocument, IconSignal, IconMessageCircle, IconEye } from '../components/Icons.jsx';
import NexLineChart from '../components/Charts/LineChart.jsx';
import BarComparison from '../components/Charts/BarComparison.jsx';
import YearView from '../components/Charts/YearView.jsx';
import MembersDirectory from '../components/MembersDirectory.jsx';
import { summaryFromAgg, toChartSeries, flattenPosts } from '../utils/normalize.js';
import styles from './Dashboard.module.css';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const COMPARE_METRICS = [
  { key: 'reach', label: 'Alcance' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'impressions', label: 'Impressões' },
];

function SkeletonCard() {
  return (
    <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [tab, setTab] = useState('month'); // 'month' | 'year'

  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [compare, setCompare] = useState(null);
  const [yearData, setYearData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) {
    yearOptions.push(y);
  }

  // Backend returns { current, previous, variation } with aggregated metric keys.
  const cur = summaryFromAgg(summary?.current);
  const prev = summaryFromAgg(summary?.previous);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className={styles.filters}>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Community directory — active influencers (view-only) */}
      <h2 className="section-title">Influenciadores Nex</h2>
      <MembersDirectory />

      {/* Metric cards */}
      <h2 className="section-title" style={{ marginTop: 24 }}>Suas métricas</h2>
      <div className="metrics-grid">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              label="Total de Posts"
              value={cur.total_posts}
              icon={<IconDocument size={16} />}
              previousValue={prev.total_posts}
            />
            <MetricCard
              label="Alcance Total"
              value={cur.total_reach}
              icon={<IconSignal size={16} />}
              previousValue={prev.total_reach}
            />
            <MetricCard
              label="Engajamento Médio"
              value={cur.avg_engagement_rate}
              unit="%"
              icon={<IconMessageCircle size={16} />}
              previousValue={prev.avg_engagement_rate}
            />
            <MetricCard
              label="Impressões Totais"
              value={cur.total_impressions}
              icon={<IconEye size={16} />}
              previousValue={prev.total_impressions}
            />
          </>
        )}
      </div>

      {/* Chart tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'month' ? 'active' : ''}`}
          onClick={() => setTab('month')}
        >
          Mês Atual
        </button>
        <button
          className={`tab-btn ${tab === 'year' ? 'active' : ''}`}
          onClick={() => setTab('year')}
        >
          Visão Anual
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 8, marginBottom: 24 }} />
      ) : tab === 'month' ? (
        <div className={styles.chartsRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NexLineChart
              data={history}
              xKey="month"
              title="Evolução — Alcance e Engajamento"
              lines={[
                { key: 'reach', name: 'Alcance', color: '#000000' },
                { key: 'engagement_rate', name: 'Engajamento (%)', color: '#FFD400' },
              ]}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BarComparison
              currentData={compare?.current || {}}
              previousData={compare?.previous || {}}
              metrics={COMPARE_METRICS}
            />
          </div>
        </div>
      ) : (
        <YearView data={yearData} />
      )}

      {/* Posts */}
      <div style={{ marginTop: 32 }}>
        <h2 className="section-title">Posts do Período</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : (
          <PostList posts={posts} />
        )}
      </div>
    </div>
  );
}
