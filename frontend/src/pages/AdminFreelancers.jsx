import React, { useState, useEffect } from 'react';
import api from '../api.js';
import {
  IconEye, IconHeart, IconMessageCircle, IconRefresh, IconDocument, IconPlus, IconCamera,
  IconTrash, IconExternal, IconList,
} from '../components/Icons.jsx';
import { PageHeader, EmptyState, Skeleton, Modal, Avatar, Spinner, Menu, MenuItem } from '../components/ui.jsx';
import { formatCompact } from '../utils/format.js';
import styles from './AdminFreelancers.module.css';

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

function Stat({ icon, label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{icon}{label}</span>
      <span className={styles.statValue}>{formatCompact(value)}</span>
    </div>
  );
}

const EMPTY_POST = { post_url: '', format: 'feed', likes: '', views: '', comments: '', reposts: '' };

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
  const [postForm, setPostForm] = useState(EMPTY_POST);
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

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!createForm.name.trim()) return;
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
    setPostForm(EMPTY_POST);
    setPostError('');
    setPostModalFor(inf);
  };

  const handleSavePost = async (e) => {
    e?.preventDefault();
    if (!postForm.post_url.trim()) return;
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
    setInfluencerPosts([]);
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

  const setPostField = (key) => (e) => setPostForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Influenciadores' }]}
        title="Influenciadores avulsos"
        subtitle="Parcerias pontuais sem login no sistema. Cadastre o influenciador e registre manualmente os posts feitos — link, formato e métricas."
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={fetchInfluencers} disabled={loading}>
              <IconRefresh size={14} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus size={15} /> Adicionar influenciador
            </button>
          </>
        )}
      />

      {migrationPending && (
        <div className="alert alert-error">
          As tabelas de influenciadores avulsos ainda não existem no banco. Rode a migration 007_freelance_influencers.sql no Supabase.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="grid-auto"><Skeleton height={220} /><Skeleton height={220} /><Skeleton height={220} /></div>
      ) : influencers.length === 0 ? (
        <EmptyState
          bordered
          icon={<IconCamera size={20} />}
          title="Nenhum influenciador avulso cadastrado"
          text="Cadastre parcerias pontuais para acompanhar os resultados junto com a rede."
          action={<button type="button" className="btn btn-primary btn-sm" onClick={openCreate}><IconPlus size={14} /> Adicionar influenciador</button>}
        />
      ) : (
        <div className="grid-auto">
          {influencers.map((inf) => (
            <article key={inf.id} className={`card ${styles.card}`}>
              <header className={styles.cardHeader}>
                <Avatar name={inf.name} size={40} variant="muted" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className={styles.name}>{inf.name}</h3>
                  {inf.notes && <p className={styles.notes}>{inf.notes}</p>}
                </div>
                <Menu buttonClassName="btn btn-icon" label={`Mais ações para ${inf.name}`}>
                  <MenuItem icon={<IconTrash size={15} />} danger onClick={() => handleDeleteInfluencer(inf)}>
                    Excluir influenciador
                  </MenuItem>
                </Menu>
              </header>

              <div className={styles.formats}>
                {inf.formats && inf.formats.length > 0 ? (
                  inf.formats.map((f) => <span key={f} className="badge badge-neutral">{formatLabel(f)}</span>)
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>Nenhum post registrado</span>
                )}
              </div>

              <div className={styles.stats}>
                <Stat icon={<IconDocument size={12} />} label="Posts" value={inf.post_count} />
                <Stat icon={<IconEye size={12} />} label="Views" value={inf.total_views} />
                <Stat icon={<IconHeart size={12} />} label="Curtidas" value={inf.total_likes} />
                <Stat icon={<IconMessageCircle size={12} />} label="Coment." value={inf.total_comments} />
                <Stat icon={<IconRefresh size={12} />} label="Reposts" value={inf.total_reposts} />
              </div>

              <footer className={styles.actions}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openPostModal(inf)}>
                  <IconPlus size={14} /> Registrar post
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openViewPosts(inf)}>
                  <IconList size={14} /> Ver posts ({inf.post_count || 0})
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* Create influencer modal */}
      {showCreate && (
        <Modal
          title="Adicionar influenciador avulso"
          onClose={() => setShowCreate(false)}
          maxWidth={460}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</button>
              <button type="submit" form="create-freelancer" className="btn btn-primary" disabled={creating || !createForm.name.trim()}>
                {creating ? <><Spinner /> Criando...</> : 'Criar'}
              </button>
            </>
          )}
        >
          <form id="create-freelancer" onSubmit={handleCreate} noValidate>
            {createError && <div className="alert alert-error">{createError}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="fl-name">Nome</label>
              <input
                id="fl-name"
                type="text"
                className="form-control"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="fl-notes">Observações <span className="muted">(opcional)</span></label>
              <input
                id="fl-notes"
                type="text"
                className="form-control"
                placeholder="ex: parceria pontual, campanha X"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Register post modal */}
      {postModalFor && (
        <Modal
          title="Registrar post"
          subtitle={postModalFor.name}
          onClose={() => setPostModalFor(null)}
          maxWidth={520}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setPostModalFor(null)} disabled={savingPost}>Cancelar</button>
              <button type="submit" form="register-freelance-post" className="btn btn-primary" disabled={savingPost || !postForm.post_url.trim()}>
                {savingPost ? <><Spinner /> Salvando...</> : 'Registrar'}
              </button>
            </>
          )}
        >
          <form id="register-freelance-post" onSubmit={handleSavePost} noValidate>
            {postError && <div className="alert alert-error">{postError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="fp-url">Link do post</label>
              <input
                id="fp-url"
                type="url"
                className="form-control"
                placeholder="https://www.instagram.com/p/..."
                value={postForm.post_url}
                onChange={setPostField('post_url')}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fp-format">Formato</label>
              <select id="fp-format" className="form-control" value={postForm.format} onChange={setPostField('format')}>
                {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="form-grid">
              {[
                ['views', 'Visualizações'],
                ['likes', 'Curtidas'],
                ['comments', 'Comentários'],
                ['reposts', 'Reposts'],
              ].map(([key, label]) => (
                <div key={key} className="form-group">
                  <label className="form-label" htmlFor={`fp-${key}`}>{label}</label>
                  <input
                    id={`fp-${key}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="form-control"
                    value={postForm[key]}
                    onChange={setPostField(key)}
                  />
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}

      {/* View posts modal */}
      {viewingPostsFor && (
        <Modal
          title="Posts registrados"
          subtitle={viewingPostsFor.name}
          onClose={() => setViewingPostsFor(null)}
          maxWidth={760}
        >
          {loadingPosts ? (
            <Skeleton height={160} />
          ) : influencerPosts.length === 0 ? (
            <EmptyState icon={<IconList size={20} />} title="Nenhum post registrado ainda" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Formato</th>
                    <th className="num">Views</th>
                    <th className="num">Curtidas</th>
                    <th className="num">Coment.</th>
                    <th className="num">Reposts</th>
                    <th><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {influencerPosts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="link-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Abrir <IconExternal size={12} />
                        </a>
                      </td>
                      <td><span className="badge badge-neutral">{formatLabel(p.format)}</span></td>
                      <td className="num">{formatCompact(p.views)}</td>
                      <td className="num">{formatCompact(p.likes)}</td>
                      <td className="num">{formatCompact(p.comments)}</td>
                      <td className="num">{formatCompact(p.reposts)}</td>
                      <td className="num">
                        <button type="button" className="btn btn-icon danger" onClick={() => handleDeletePost(p)} title="Excluir post" aria-label="Excluir post">
                          <IconTrash size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
