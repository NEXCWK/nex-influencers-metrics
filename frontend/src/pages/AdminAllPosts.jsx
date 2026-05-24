import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import styles from './AdminAllPosts.module.css';

const MONTHS = [
  { value: '', label: 'Todos os meses' },
  ...['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .map((m, i) => ({ value: String(i + 1), label: m })),
];

const PLATFORMS = [
  { value: '', label: 'Todas as plataformas' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZE = 10;

function formatNum(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
}

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR');
}

function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 8, padding: 16, maxWidth: 700, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <img src={src} alt="Post" style={{ width: '100%', borderRadius: 6, objectFit: 'contain', maxHeight: 560 }} />
      </div>
    </div>
  );
}

function EditMetricsModal({ post, onSave, onClose }) {
  const FIELDS = [
    { key: 'reach', label: 'Alcance' },
    { key: 'impressions', label: 'Impressões' },
    { key: 'likes', label: 'Curtidas' },
    { key: 'comments', label: 'Comentários' },
    { key: 'shares', label: 'Compartilhamentos' },
    { key: 'saves', label: 'Salvamentos' },
    { key: 'plays', label: 'Plays' },
    { key: 'engagement_rate', label: 'Engajamento (%)' },
    { key: 'profile_visits', label: 'Visitas ao Perfil' },
    { key: 'link_clicks', label: 'Cliques no Link' },
  ];

  const [values, setValues] = useState(() => {
    const init = {};
    FIELDS.forEach(({ key }) => { init[key] = post[key] !== undefined ? String(post[key]) : ''; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {};
      FIELDS.forEach(({ key }) => {
        if (values[key] !== '') payload[key] = parseFloat(values[key]);
      });
      await api.patch(`/posts/${post.id}/metrics`, payload);
      onSave({ ...post, ...payload });
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao salvar métricas.');
    } finally {
      setSaving(false);
    }
  };

  if (!post) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Editar Métricas</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, fontFamily: 'Arial' }}>
          {post.title || 'Post sem título'}
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className={styles.editGrid}>
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">{label}</label>
              <input
                type="number"
                step={key === 'engagement_rate' ? '0.01' : '1'}
                min="0"
                className="form-control"
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAllPosts() {
  const [influencerFilter, setInfluencerFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [platformFilter, setPlatformFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedImg, setExpandedImg] = useState(null);
  const [editPost, setEditPost] = useState(null);

  // Load influencer list for filter dropdown
  useEffect(() => {
    api.get('/admin/influencers').then((res) => {
      setInfluencers(res.data?.influencers || res.data || []);
    }).catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const p = { page, page_size: PAGE_SIZE };
    if (influencerFilter) p.influencer_id = influencerFilter;
    if (monthFilter) p.month = monthFilter;
    if (yearFilter) p.year = yearFilter;
    if (platformFilter) p.platform = platformFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [influencerFilter, monthFilter, yearFilter, platformFilter, dateFrom, dateTo, page]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/posts', { params: buildParams() });
      const data = res.data;
      setPosts(data.posts || data.items || data || []);
      setTotal(data.total || (data.posts?.length) || 0);
    } catch {
      setError('Erro ao carregar posts.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPosts();
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Excluir o post "${post.title || 'post'}"?`)) return;
    try {
      await api.delete(`/posts/${post.id}`);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((t) => t - 1);
    } catch {
      alert('Erro ao excluir post.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/admin/export', {
        params: buildParams(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nex-posts-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar CSV.');
    }
  };

  const handleEditSaved = (updatedPost) => {
    setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? updatedPost : p));
    setEditPost(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) yearOptions.push(String(y));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Todos os Posts</h1>
        <button className="btn btn-secondary" onClick={handleExportCSV}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleFilterSubmit} className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={influencerFilter} onChange={(e) => setInfluencerFilter(e.target.value)}>
          <option value="">Todos os influenciadores</option>
          {influencers.map((inf) => (
            <option key={inf.id} value={inf.id}>{inf.display_name || inf.username}</option>
          ))}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">Todos os anos</option>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="De" />
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Até" />
        <button type="submit" className="btn btn-primary btn-sm">Filtrar</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
          setInfluencerFilter(''); setMonthFilter(''); setYearFilter(String(CURRENT_YEAR));
          setPlatformFilter(''); setDateFrom(''); setDateTo(''); setPage(1);
        }}>Limpar</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 8 }} />
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Influenciador</th>
                  <th>Plataforma</th>
                  <th>Data</th>
                  <th>Alcance</th>
                  <th>Curtidas</th>
                  <th>Engajamento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 32 }}>
                      Nenhum post encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {post.image_url ? (
                          <img
                            src={post.image_url}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)' }}
                            onClick={() => setExpandedImg(post.image_url)}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, background: 'var(--surface)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{post.title || 'Sem título'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{post.influencer_name || post.display_name || '—'}</td>
                    <td><span className={`platform-${post.platform}`}>{post.platform}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(post.published_date || post.created_at)}</td>
                    <td>{formatNum(post.reach)}</td>
                    <td>{formatNum(post.likes)}</td>
                    <td>{post.engagement_rate != null ? `${parseFloat(post.engagement_rate).toFixed(2)}%` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditPost(post)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(post)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                );
              })}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ImageModal src={expandedImg} onClose={() => setExpandedImg(null)} />
      {editPost && (
        <EditMetricsModal post={editPost} onSave={handleEditSaved} onClose={() => setEditPost(null)} />
      )}
    </div>
  );
}
