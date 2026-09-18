import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { IconEye, IconHeart, IconMessageCircle, IconUpload, IconDocument } from '../components/Icons.jsx';

const FORMAT_OPTIONS = [
  { value: 'feed', label: 'Feed' },
  { value: 'story', label: 'Story' },
  { value: 'reels', label: 'Reels' },
  { value: 'video', label: 'Vídeo' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'live', label: 'Live' },
  { value: 'outro', label: 'Outro' },
];

function formatLabel(value) {
  return FORMAT_OPTIONS.find((f) => f.value === value)?.label || value;
}

function formatNum(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
}

function Stat({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 70 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatNum(value)}</div>
    </div>
  );
}

export default function AdminFreelancers() {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migrationPending, setMigrationPending] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [postModalFor, setPostModalFor] = useState(null); // influencer object | null
  const [postForm, setPostForm] = useState({ post_url: '', format: 'feed', likes: '', views: '', comments: '', reposts: '' });
  const [savingPost, setSavingPost] = useState(false);
  const [postError, setPostError] = useState('');

  const [viewingPostsFor, setViewingPostsFor] = useState(null); // influencer object | null
  const [influencerPosts, setInfluencerPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const fetchInfluencers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/freelancers');
      setInfluencers(res.data?.influencers || []);
      setMigrationPending(!!res.data?.migration_pending);
    } catch {
      setError('Erro ao carregar influenciadores avulsos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfluencers(); }, []);

  const openCreate = () => {
    setCreateForm({ name: '', notes: '' });
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/admin/freelancers', createForm);
      setShowCreate(false);
      fetchInfluencers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Erro ao criar o influenciador.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInfluencer = async (inf) => {
    if (!window.confirm(`Excluir "${inf.name}" e todos os posts registrados dele(a)?`)) return;
    try {
      await api.delete(`/admin/freelancers/${inf.id}`);
      fetchInfluencers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  const openPostModal = (inf) => {
    setPostForm({ post_url: '', format: 'feed', likes: '', views: '', comments: '', reposts: '' });
    setPostError('');
    setPostModalFor(inf);
  };

  const handleSavePost = async () => {
    setSavingPost(true);
    setPostError('');
    try {
      await api.post(`/admin/freelancers/${postModalFor.id}/posts`, {
        post_url: postForm.post_url.trim(),
        format: postForm.format,
        likes: postForm.likes,
        views: postForm.views,
        comments: postForm.comments,
        reposts: postForm.reposts,
      });
      setPostModalFor(null);
      fetchInfluencers();
    } catch (err) {
      setPostError(err.response?.data?.error || 'Erro ao registrar o post.');
    } finally {
      setSavingPost(false);
    }
  };

  const openViewPosts = async (inf) => {
    setViewingPostsFor(inf);
    setLoadingPosts(true);
    try {
      const res = await api.get(`/admin/freelancers/${inf.id}/posts`);
      setInfluencerPosts(res.data?.posts || []);
    } catch {
      setInfluencerPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm('Excluir este post?')) return;
    try {
      await api.delete(`/admin/freelancers/${viewingPostsFor.id}/posts/${post.id}`);
      setInfluencerPosts((prev) => prev.filter((p) => p.id !== post.id));
      fetchInfluencers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir o post.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Influenciadores Avulsos</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchInfluencers}>Atualizar</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Adicionar influenciador</button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-muted)', fontFamily: 'var(--font)', marginBottom: 20, maxWidth: 640 }}>
        Cadastre aqui influenciadores que não têm login no sistema (parcerias avulsas/pontuais)
        e registre manualmente os posts que eles fizeram — link, formato, curtidas, visualizações,
        comentários e reposts.
      </p>

      {migrationPending && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          As tabelas de influenciadores avulsos ainda não existem no banco. Rode a migration 007_freelance_influencers.sql no Supabase.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
      ) : influencers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
          Nenhum influenciador avulso cadastrado ainda.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {influencers.map((inf) => (
            <div key={inf.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{inf.name}</div>
                  {inf.notes && <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{inf.notes}</div>}
                </div>
                <button
                  className="btn btn-danger-outline btn-sm"
                  onClick={() => handleDeleteInfluencer(inf)}
                  title="Excluir influenciador avulso"
                >
                  Excluir
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
                {inf.formats && inf.formats.length > 0 ? (
                  inf.formats.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        border: '1px solid var(--border)', color: 'var(--ink-soft)', background: 'var(--surface-muted)',
                      }}
                    >
                      {formatLabel(f)}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Nenhum post registrado</span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16 }}>
                <Stat icon={<IconDocument size={12} />} label="Posts" value={inf.post_count} />
                <Stat icon={<IconEye size={12} />} label="Visualizações" value={inf.total_views} />
                <Stat icon={<IconHeart size={12} />} label="Curtidas" value={inf.total_likes} />
                <Stat icon={<IconMessageCircle size={12} />} label="Comentários" value={inf.total_comments} />
                <Stat icon={<IconUpload size={12} />} label="Reposts" value={inf.total_reposts} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => openPostModal(inf)}>+ Registrar post</button>
                <button className="btn btn-secondary btn-sm" onClick={() => openViewPosts(inf)}>Ver posts ({inf.post_count})</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create influencer modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">Adicionar influenciador avulso</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            {createError && <div className="alert alert-error">{createError}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Nome</label>
              <input
                type="text"
                className="form-control"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Observações (opcional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="ex: parceria pontual, campanha X"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !createForm.name.trim()}>
                {creating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register post modal */}
      {postModalFor && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPostModalFor(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar post — {postModalFor.name}</h2>
              <button className="modal-close" onClick={() => setPostModalFor(null)}>×</button>
            </div>
            {postError && <div className="alert alert-error">{postError}</div>}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Link do post</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://www.instagram.com/p/..."
                value={postForm.post_url}
                onChange={(e) => setPostForm((f) => ({ ...f, post_url: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Formato</label>
              <select
                className="form-control"
                value={postForm.format}
                onChange={(e) => setPostForm((f) => ({ ...f, format: e.target.value }))}
              >
                {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div className="form-group">
                <label className="form-label">Curtidas</label>
                <input type="number" min="0" className="form-control" value={postForm.likes}
                  onChange={(e) => setPostForm((f) => ({ ...f, likes: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Visualizações</label>
                <input type="number" min="0" className="form-control" value={postForm.views}
                  onChange={(e) => setPostForm((f) => ({ ...f, views: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Comentários</label>
                <input type="number" min="0" className="form-control" value={postForm.comments}
                  onChange={(e) => setPostForm((f) => ({ ...f, comments: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reposts</label>
                <input type="number" min="0" className="form-control" value={postForm.reposts}
                  onChange={(e) => setPostForm((f) => ({ ...f, reposts: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setPostModalFor(null)} disabled={savingPost}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSavePost} disabled={savingPost || !postForm.post_url.trim()}>
                {savingPost ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View posts modal */}
      {viewingPostsFor && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewingPostsFor(null)}>
          <div className="modal-card" style={{ maxWidth: 640, width: '100%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Posts — {viewingPostsFor.name}</h2>
              <button className="modal-close" onClick={() => setViewingPostsFor(null)}>×</button>
            </div>
            {loadingPosts ? (
              <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
            ) : influencerPosts.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>Nenhum post registrado ainda.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Formato</th>
                      <th>Visualizações</th>
                      <th>Curtidas</th>
                      <th>Comentários</th>
                      <th>Reposts</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {influencerPosts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <a href={p.post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                            Abrir post
                          </a>
                        </td>
                        <td>{formatLabel(p.format)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(p.views)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(p.likes)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(p.comments)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNum(p.reposts)}</td>
                        <td>
                          <button className="btn btn-danger-outline btn-sm" onClick={() => handleDeletePost(p)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
