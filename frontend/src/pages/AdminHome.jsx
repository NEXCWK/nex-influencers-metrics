import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import styles from './AdminHome.module.css';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const PLATFORMS = [
  { value: '', label: 'Todas as plataformas' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

function formatNum(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
}

function SkeletonCard() {
  return <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [platform, setPlatform] = useState('');
  const [sortBy, setSortBy] = useState('reach'); // 'reach' | 'engagement_rate'
  const [sortDir, setSortDir] = useState('desc');

  const [overview, setOverview] = useState(null);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { month, year, ...(platform ? { platform } : {}) };
      const [overviewRes, influencersRes] = await Promise.all([
        api.get('/admin/overview', { params }),
        api.get('/admin/influencers', { params }),
      ]);
      setOverview(overviewRes.data);
      setInfluencers(influencersRes.data?.influencers || influencersRes.data || []);
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [month, year, platform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) yearOptions.push(y);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sorted = [...influencers].sort((a, b) => {
    const valA = parseFloat(a[sortBy]) || 0;
    const valB = parseFloat(b[sortBy]) || 0;
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: '#bbb' }}> ⇅</span>;
    return <span style={{ color: 'var(--accent)' }}> {sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Visão Geral — Admin</h1>
        <div className={styles.filters}>
          <select className="form-control" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Overview metric cards */}
      <div className="metrics-grid">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <MetricCard label="Influenciadores Ativos" value={overview?.active_influencers ?? 0} icon="👥" />
            <MetricCard label="Total de Posts" value={overview?.total_posts ?? 0} icon="📄" />
            <MetricCard label="Alcance Total" value={overview?.total_reach ?? 0} icon="📡" />
            <MetricCard label="Engajamento Médio" value={overview?.avg_engagement ?? 0} unit="%" icon="💬" />
          </>
        )}
      </div>

      {/* Ranking table */}
      <div style={{ marginTop: 8 }}>
        <h2 className="section-title">Ranking de Influenciadores</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 240, borderRadius: 8 }} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Nome</th>
                  <th>Posts</th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('reach')}
                  >
                    Alcance<SortIcon col="reach" />
                  </th>
                  <th>Curtidas</th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('engagement_rate')}
                  >
                    Engajamento<SortIcon col="engagement_rate" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: 32 }}>
                      Nenhum dado para o período selecionado.
                    </td>
                  </tr>
                ) : (
                  sorted.map((inf, idx) => (
                    <tr key={inf.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: idx < 3 ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13 }}>
                          {idx + 1}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/admin/influencers/${inf.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 14,
                            fontFamily: 'Arial, sans-serif',
                            color: 'var(--text-primary)',
                            padding: 0,
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          {inf.display_name || inf.username}
                        </button>
                      </td>
                      <td>{inf.posts_count ?? 0}</td>
                      <td>{formatNum(inf.reach)}</td>
                      <td>{formatNum(inf.likes)}</td>
                      <td>
                        {inf.engagement_rate !== null && inf.engagement_rate !== undefined
                          ? `${parseFloat(inf.engagement_rate).toFixed(2)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
