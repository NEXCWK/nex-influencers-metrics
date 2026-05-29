import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import { flattenRanking } from '../utils/normalize.js';
import { IconUsers, IconDocument, IconSignal, IconMessageCircle } from '../components/Icons.jsx';
import styles from './AdminHome.module.css';

const MONTHS = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
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
  return <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [platform, setPlatform] = useState('');
  const [sortBy, setSortBy] = useState('reach');
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
      setInfluencers(flattenRanking(influencersRes.data?.ranking));
    } catch {
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

  const sorted = (Array.isArray(influencers) ? [...influencers] : []).sort((a, b) => {
    const valA = parseFloat(a[sortBy]) || 0;
    const valB = parseFloat(b[sortBy]) || 0;
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const maxEngagement = Math.max(...sorted.map((inf) => parseFloat(inf.engagement_rate) || 0), 0.001);

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: '#ccc', fontSize: 11 }}> ⇅</span>;
    return <span style={{ color: 'var(--accent)', fontSize: 11 }}> {sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div>
      <div className={`page-header ${styles.stickyHeader}`}>
        <h1 className="page-title">Visao Geral</h1>
        <div className={styles.toolbarPill}>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <span className={styles.toolbarDivider} />
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className={styles.toolbarDivider} />
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <MetricCard label="Influenciadores Ativos" value={overview?.active_influencers ?? 0} icon={<IconUsers size={16} />} />
            <MetricCard label="Total de Posts" value={overview?.total_posts ?? 0} icon={<IconDocument size={16} />} />
            <MetricCard label="Alcance Total" value={overview?.aggregate?.reach ?? 0} icon={<IconSignal size={16} />} />
            <MetricCard label="Engajamento Medio" value={overview?.aggregate?.engagement_rate ?? 0} unit="%" icon={<IconMessageCircle size={16} />} />
          </>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <h2 className="section-title">Ranking de Influenciadores</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Nome</th>
                  <th>Posts</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('reach')}>
                    Alcance<SortIcon col="reach" />
                  </th>
                  <th>Curtidas</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('engagement_rate')}>
                    Engajamento<SortIcon col="engagement_rate" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, border: 0 }}>
                      <div className={styles.emptyState}>
                        <p className={styles.emptyStateTitle}>
                          Sem dados em {MONTHS[month - 1]}/{year}
                        </p>
                        <button
                          className={styles.emptyStateLink}
                          onClick={() => setMonth(CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1)}
                        >
                          Ver mes anterior
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((inf, idx) => {
                    const engRate = parseFloat(inf.engagement_rate) || 0;
                    const barWidth = maxEngagement > 0 ? (engRate / maxEngagement) * 100 : 0;
                    return (
                      <tr
                        key={inf.id}
                        onClick={() => navigate(`/admin/influencers/${inf.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          {idx < 3 ? (
                            <span className={styles.rankChip}>{idx + 1}</span>
                          ) : (
                            <span className={styles.rankNum}>{idx + 1}</span>
                          )}
                        </td>
                        <td>
                          <span className={styles.influencerBtn}>
                            {inf.display_name || inf.username}
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{inf.posts_count ?? 0}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(inf.reach)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(inf.likes)}</td>
                        <td>
                          <div className={styles.sparkbarWrap}>
                            <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 48, fontSize: 13 }}>
                              {engRate > 0 ? `${engRate.toFixed(2)}%` : '—'}
                            </span>
                            {engRate > 0 && (
                              <div className={styles.sparkbarTrack}>
                                <div className={styles.sparkbarFill} style={{ width: `${barWidth}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
