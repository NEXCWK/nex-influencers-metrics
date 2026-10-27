import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import { flattenRanking } from '../utils/normalize.js';
import {
  IconUsers, IconDocument, IconSignal, IconEye, IconHeart, IconChevronRight, IconBarChart,
} from '../components/Icons.jsx';
import { PageHeader, SectionHeader, MonthSelect, YearSelect, EmptyState, Skeleton, Avatar } from '../components/ui.jsx';
import { MONTHS, PLATFORMS, currentMonth, currentYear, formatCompact } from '../utils/format.js';

const SORT_COLUMNS = [
  { key: 'impressions', label: 'Visualizações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'reach', label: 'Alcance' },
];

export default function AdminHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Coming back from an influencer's page keeps the period that was open.
  const urlMonth = parseInt(searchParams.get('month'), 10);
  const urlYear = parseInt(searchParams.get('year'), 10);
  const [month, setMonth] = useState(urlMonth >= 1 && urlMonth <= 12 ? urlMonth : currentMonth());
  const [year, setYear] = useState(!isNaN(urlYear) ? urlYear : currentYear());
  const [platform, setPlatform] = useState('');
  const [sortBy, setSortBy] = useState('impressions');
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

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  // "Ver mês anterior" goes back one month from the SELECTED period (it used
  // to jump relative to today and never crossed into the previous year).
  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const sorted = (Array.isArray(influencers) ? [...influencers] : []).sort((a, b) => {
    const valA = parseFloat(a[sortBy]) || 0;
    const valB = parseFloat(b[sortBy]) || 0;
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const sortIndicator = (col) => {
    if (sortBy !== col) return <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}> ↕</span>;
    return <span aria-hidden="true"> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const feed = overview?.total_feed;
  const stories = overview?.total_stories;

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={`Desempenho da rede de influenciadores em ${MONTHS[month - 1].toLowerCase()} de ${year}.`}
        actions={(
          <>
            <MonthSelect value={month} onChange={setMonth} style={{ width: 'auto' }} />
            <YearSelect value={year} onChange={setYear} style={{ width: 'auto' }} />
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Plataforma"
            >
              <option value="">Todas as plataformas</option>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </>
        )}
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid">
        {loading ? (
          <><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /><Skeleton height={124} /></>
        ) : (
          <>
            <MetricCard label="Visualizações" value={overview?.aggregate?.impressions ?? 0} icon={<IconEye size={16} />} highlight />
            <MetricCard label="Curtidas" value={overview?.aggregate?.likes ?? 0} icon={<IconHeart size={16} />} highlight />
            <MetricCard label="Alcance" value={overview?.aggregate?.reach ?? 0} icon={<IconSignal size={16} />} />
            <MetricCard
              label="Posts"
              value={overview?.total_posts ?? 0}
              unit="raw"
              icon={<IconDocument size={16} />}
              hint={feed != null && stories != null ? `${feed} feed · ${stories} stories` : undefined}
            />
            <MetricCard label="Influenciadores ativos" value={overview?.active_influencers ?? 0} unit="raw" icon={<IconUsers size={16} />} hint="com posts no período" />
          </>
        )}
      </div>

      <section className="section">
        <SectionHeader
          title="Ranking de influenciadores"
          hint="Clique em um influenciador para ver o painel completo."
        />
        {loading ? (
          <Skeleton height={260} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Influenciador</th>
                  <th className="num hide-sm">Feed</th>
                  <th className="num hide-sm">Stories</th>
                  {SORT_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`num sortable ${sortBy === c.key ? 'sorted' : ''}`}
                      onClick={() => handleSort(c.key)}
                      aria-sort={sortBy === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {c.label}{sortIndicator(c.key)}
                    </th>
                  ))}
                  <th style={{ width: 40 }}><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <EmptyState
                        icon={<IconBarChart size={20} />}
                        title={`Sem dados em ${MONTHS[month - 1]}/${year}`}
                        text="Nenhum influenciador ativo tem posts neste período."
                        action={<button type="button" className="link-btn" onClick={goToPreviousMonth}>Ver mês anterior</button>}
                      />
                    </td>
                  </tr>
                ) : (
                  sorted.map((inf, idx) => {
                    const name = inf.display_name || inf.username;
                    return (
                      <tr
                        key={inf.id}
                        className="clickable"
                        onClick={() => navigate(`/admin/influencers/${inf.id}?year=${year}&month=${month}`)}
                      >
                        <td>
                          <span className={`rank ${idx < 3 ? 'rank-top' : ''}`}>{idx + 1}</span>
                        </td>
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <Avatar name={name} size={30} variant="muted" />
                            <div style={{ minWidth: 0 }}>
                              <div className="cell-title">{name}</div>
                              <div className="cell-sub">@{inf.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="num hide-sm">{inf.feed_count ?? 0}</td>
                        <td className="num hide-sm">{inf.story_count ?? 0}</td>
                        <td className="num strong">{formatCompact(inf.impressions)}</td>
                        <td className="num strong">{formatCompact(inf.likes)}</td>
                        <td className="num">{formatCompact(inf.reach)}</td>
                        <td className="muted"><IconChevronRight size={16} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
