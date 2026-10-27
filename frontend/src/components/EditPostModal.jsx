import React, { useState } from 'react';
import api from '../api.js';
import { Modal, Spinner } from './ui.jsx';
import { FormatBadge } from './PostBadges.jsx';

const FIELDS = [
  { key: 'impressions', label: 'Visualizações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'reach', label: 'Alcance (contas alcançadas)' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saves', label: 'Salvamentos' },
  { key: 'plays', label: 'Reproduções (vídeo)' },
  { key: 'engagement_rate', label: 'Taxa de engajamento (%)' },
  { key: 'profile_visits', label: 'Visitas ao perfil' },
  { key: 'link_clicks', label: 'Cliques no link' },
];

/**
 * Modal to edit a post's publication date (month) and metrics without deleting
 * and re-uploading. `endpoint` decides the scope: `/posts/:id` for the owner,
 * `/admin/posts/:id` for admins.
 */
export default function EditPostModal({ post, endpoint, onSaved, onClose }) {
  const [date, setDate] = useState(() => {
    const d = post?.published_at || post?.published_date || '';
    return typeof d === 'string' ? d.slice(0, 10) : '';
  });
  const [postUrl, setPostUrl] = useState(post?.post_url || '');
  const [values, setValues] = useState(() => {
    const init = {};
    FIELDS.forEach(({ key }) => {
      init[key] = post?.[key] != null ? String(post[key]) : '';
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e?.preventDefault();
    setError('');
    if (postUrl.trim() && !/^https?:\/\/\S+$/i.test(postUrl.trim())) {
      setError('O link do post deve começar com http:// ou https://');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      FIELDS.forEach(({ key }) => {
        if (values[key] !== '') payload[key] = parseFloat(values[key]);
      });
      if (date) payload.published_at = date;
      payload.post_url = postUrl.trim();
      await api.patch(endpoint, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (!post) return null;
  return (
    <Modal
      title="Editar post"
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {post.title || 'Post sem título'} <FormatBadge type={post.post_type} />
        </span>
      }
      onClose={onClose}
      maxWidth={620}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="edit-post-form" className="btn btn-primary" disabled={saving}>
            {saving ? <><Spinner /> Salvando...</> : 'Salvar alterações'}
          </button>
        </>
      )}
    >
      <form id="edit-post-form" onSubmit={handleSave} noValidate>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="edit-date">Data de publicação</label>
            <input
              id="edit-date"
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="form-hint">Define em qual mês o post aparece nos painéis.</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-url">Link do post <span className="muted">(opcional)</span></label>
            <input
              id="edit-url"
              type="url"
              className="form-control"
              placeholder="https://www.instagram.com/p/..."
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
            />
          </div>
        </div>

        <p className="eyebrow" style={{ margin: '8px 0 12px' }}>Métricas</p>
        <div className="form-grid">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="form-group">
              <label className="form-label" htmlFor={`edit-${key}`}>{label}</label>
              <input
                id={`edit-${key}`}
                type="number"
                inputMode="decimal"
                step={key === 'engagement_rate' ? '0.01' : '1'}
                min="0"
                className="form-control"
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
