import React, { useState } from 'react';
import api from '../api.js';

const FIELDS = [
  { key: 'reach', label: 'Alcance (Contas alcançadas)' },
  { key: 'impressions', label: 'Visualizações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saves', label: 'Salvamentos' },
  { key: 'plays', label: 'Reproduções (vídeo)' },
  { key: 'engagement_rate', label: 'Taxa de Engajamento (%)' },
  { key: 'profile_visits', label: 'Visitas ao Perfil' },
  { key: 'link_clicks', label: 'Cliques no Link' },
];

/**
 * Modal to edit a post's publication date (month) and metrics without deleting
 * and re-uploading. `endpoint` decides the scope: `/posts/:id` for the owner,
 * `/admin/posts/:id` for admins.
 */
export default function EditPostModal({ post, endpoint, onSaved, onClose }) {
  const [date, setDate] = useState(() => {
    const d = post.published_at || post.published_date || '';
    return typeof d === 'string' ? d.slice(0, 10) : '';
  });
  const [values, setValues] = useState(() => {
    const init = {};
    FIELDS.forEach(({ key }) => {
      init[key] = post[key] != null ? String(post[key]) : '';
    });
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
      if (date) payload.published_at = date;
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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Editar Post</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {post.title || 'Post sem título'}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Data de publicação (define o mês no dashboard)</label>
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="form-group" style={{ marginBottom: 4 }}>
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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
