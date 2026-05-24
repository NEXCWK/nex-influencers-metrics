import React, { useState, useEffect } from 'react';
import api from '../api.js';
import styles from './MetricConfirmModal.module.css';

const METRIC_FIELDS = [
  { key: 'reach', label: 'Alcance (Reach)' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saves', label: 'Salvamentos' },
  { key: 'plays', label: 'Plays / Views' },
  { key: 'engagement_rate', label: 'Taxa de Engajamento (%)' },
  { key: 'profile_visits', label: 'Visitas ao Perfil' },
  { key: 'link_clicks', label: 'Cliques no Link' },
];

function ConfidenceBadge({ confidence }) {
  if (confidence === 'high') {
    return <span className="badge badge-success">Alta confiança</span>;
  }
  if (confidence === 'medium') {
    return <span className="badge badge-warning">Confiança média</span>;
  }
  return <span className="badge badge-danger">Baixa confiança</span>;
}

/**
 * Props:
 *  isOpen: bool
 *  metrics: object with metric values extracted by AI
 *  postId: string/number
 *  confidence: 'high' | 'medium' | 'low'
 *  notes: string (AI notes/observations)
 *  onConfirm: (confirmedMetrics) => void
 *  onClose: () => void
 */
export default function MetricConfirmModal({
  isOpen,
  metrics = {},
  postId,
  confidence,
  notes,
  onConfirm,
  onClose,
}) {
  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && metrics) {
      const init = {};
      METRIC_FIELDS.forEach(({ key }) => {
        init[key] = metrics[key] !== undefined ? String(metrics[key]) : '';
      });
      setValues(init);
      setEditMode(confidence === 'low');
      setError('');
    }
  }, [isOpen, metrics, confidence]);

  if (!isOpen) return null;

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {};
      METRIC_FIELDS.forEach(({ key }) => {
        const v = values[key];
        if (v !== '' && v !== undefined) {
          payload[key] = parseFloat(v);
        }
      });

      await api.post(`/posts/${postId}/confirm`, payload);
      onConfirm(payload);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Erro ao confirmar métricas. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Confirmar Métricas Extraídas</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* Confidence */}
        <div className={styles.confidenceRow}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Arial' }}>
            Confiança da extração:
          </span>
          <ConfidenceBadge confidence={confidence} />
        </div>

        {/* Low confidence warning */}
        {confidence === 'low' && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            ⚠️ A IA não extraiu as métricas com alta confiança. Revise e corrija os valores manualmente antes de confirmar.
          </div>
        )}

        {/* AI notes */}
        {notes && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <strong>Observação da IA:</strong> {notes}
          </div>
        )}

        {/* Edit toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? '🔒 Bloquear campos' : '✏️ Editar manualmente'}
          </button>
        </div>

        {/* Metrics grid */}
        <div className={styles.metricsGrid}>
          {METRIC_FIELDS.map(({ key, label }) => (
            <div key={key} className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">{label}</label>
              <input
                type="number"
                step={key === 'engagement_rate' ? '0.01' : '1'}
                min="0"
                className="form-control"
                value={values[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                readOnly={!editMode}
                style={!editMode ? { background: 'var(--surface)', cursor: 'default' } : {}}
              />
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Salvando...
              </>
            ) : (
              '✓ Confirmar Métricas'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
