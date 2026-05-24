import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import PostList from '../components/PostList.jsx';
import NexLineChart from '../components/Charts/LineChart.jsx';
import BarComparison from '../components/Charts/BarComparison.jsx';
import YearView from '../components/Charts/YearView.jsx';
import styles from './AdminInfluencer.module.css';

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
  return <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />;
}

function PostImageModal({ post, onClose }) {
  if (!post) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h2 className="modal-title">{post.title || 'Post'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {post.image_url && (
          <img
            src={post.image_url}
            alt={post.title}
            style={{ width: '100%', borderRadius: 8, marginBottom: 20, objectFit: 'contain', maxHeight: 500 }}
          />
        )}
        <div className={styles.postDetailGrid}>
          {[
            ['Plataforma', post.platform],
            ['Data', post.published_date || post.created_at],
            ['Alcance', post.reach],
            ['Curtidas', post.likes],
            ['Comentários', post.comments],
            ['Compartilhamentos', post.shares],
            ['Impressões', post.impressions],
            ['Engajamento', post.engagement_rate ? `${parseFloat(post.engagement_rate).toFixed(2)}%` : '—'],
          ].map(([label, val]) => (
            <div key={label} className={styles.detailItem}>
              <span className={styles.detailLabel}>{label}</span>
              <span className={styles.detailValue}>{val ?? '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminInfluencer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { month, year };
      const res = await api.get(`/admin/influencers/${id}/dashboard`, { params });
      const data = res.data;
      setInfluencer(data.influencer || null);
      setSummary(data.summary || null);
      setHistory(data.history || []);
      setCompare(data.compare || null);
      setYearData(data.year_data || []);
      setPosts(data.posts || []);
    } catch (err) {
      setError('Erro ao carregar dados do influenciador.');
    } finally {
      setLoading(false);
    }
  }, [id, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeletePost = async (post) => {
    if (!window.confirm(`Confirmar exclusão do post "${post.title || 'post'}"?`)) return;
    try {
      await api.delete(`/posts/${post.id}`);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      alert('Erro ao excluir post.');
    }
  };

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) yearOptions.push(y);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/admin')}
          >
            ← Voltar
          </button>
          <h1 className="page-title">
            {loading ? 'Carregando...' : (influencer?.display_name || influencer?.username || 'Influenciador')}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-control" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Metric cards */}
      <div className="metrics-grid">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <MetricCard label="Total de Posts" value={summary?.total_posts ?? 0} icon="📄" previousValue={compare?.previous?.total_posts} />
            <MetricCard label="Alcance Total" value={summary?.total_reach ?? 0} icon="📡" previousValue={compare?.previous?.total_reach} />
            <MetricCard label="Engajamento Médio" value={summary?.avg_engagement_rate ?? 0} unit="%" icon="💬" previousValue={compare?.previous?.avg_engagement_rate} />
            <MetricCard label="Impressões Totais" value={summary?.total_impressions ?? 0} icon="👁" previousValue={compare?.previous?.total_impressions} />
          </>
        )}
      </div>

      {/* Chart tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'month' ? 'active' : ''}`} onClick={() => setTab('month')}>Mês Atual</button>
        <button className={`tab-btn ${tab === 'year' ? 'active' : ''}`} onClick={() => setTab('year')}>Visão Anual</button>
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

      {/* Posts with admin actions */}
      <div style={{ marginTop: 32 }}>
        <h2 className="section-title">Posts do Período</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : (
          <AdminPostList posts={posts} onView={setSelectedPost} onDelete={handleDeletePost} />
        )}
      </div>

      {/* Post detail modal */}
      {selectedPost && (
        <PostImageModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}

// Extended post list with admin actions
function AdminPostList({ posts, onView, onDelete }) {
  if (!posts.length) {
    return (
      <div style={{
        textAlign: 'center', padding: '40px 16px', color: '#888',
        fontSize: 14, fontFamily: 'Arial, sans-serif',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      }}>
        Nenhum post encontrado para o período selecionado.
      </div>
    );
  }

  const formatNum = (v) => {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
    return n.toLocaleString('pt-BR');
  };

  const formatDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Post</th>
            <th>Plataforma</th>
            <th>Data</th>
            <th>Alcance</th>
            <th>Curtidas</th>
            <th>Engajamento</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {post.image_url ? (
                    <img src={post.image_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onView(post)} />
                  ) : (
                    <div style={{ width: 56, height: 56, background: 'var(--surface)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📷</div>
                  )}
                  <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'Arial' }}>{post.title || 'Sem título'}</span>
                </div>
              </td>
              <td><span className={`platform-${post.platform}`}>{post.platform}</span></td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(post.published_date || post.created_at)}</td>
              <td>{formatNum(post.reach)}</td>
              <td>{formatNum(post.likes)}</td>
              <td>{post.engagement_rate !== null && post.engagement_rate !== undefined ? `${parseFloat(post.engagement_rate).toFixed(2)}%` : '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onView(post)}>Ver</button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(post)}>Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
