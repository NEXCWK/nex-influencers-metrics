import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { IconAlert, IconPencil, IconLock } from './Icons.jsx';
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

const EXTRA_PREFIX = 'extra__';

function formatExtraLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
 *  metrics: object with metric values extracted by AI (including optional .extra{})
 *  postId: string/number
 *  confidence: 'high' | 'medium' | 'low'
 *  notes: string (AI notes/observations)
 *  aiError: string
 *  onConfirm: (confirmedMetrics) => void
 *  onClose: () => void
 */
export default function MetricConfirmModal({
  isOpen,
  metrics = {},
  postId,
  confidence,
  notes,
  aiError,
  onConfirm,
  onClose,
}) {
  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState({});
  const [extraKeys, setExtraKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && metrics) {
      const init = {};
      METRIC_FIELDS.forEach(({ key }) => {
        init[key] = metrics[key] !== undefined && metrics[key] !== null ? String(metrics[key]) : '';
      });

      const extra = metrics.extra || {};
      const ek = Object.keys(extra);
      ek.forEach((key) => {
        const val = extra[key];
        init[`${EXTRA_PREFIX}${key}`] = val !== undefined && val !== null ? String(val) : '';
      });

      setValues(init);
      setExtraKeys(ek);
      setEditMode(confidence === 'low' || !!aiError);
      setError('');
    }
  }, [isOpen, metrics, confidence, aiError]);

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

      const extraMetrics = {};
      extraKeys.forEach((key) => {
        const v = values[`${EXTRA_PREFIX}${key}`];
        if (v !== '' && v !== undefined) {
          const num = parseFloat(v);
          extraMetrics[key] = isNaN(num) ? v : num;
        }
      });
      if (Object.keys(extraMetrics).length > 0) {
        payload.extra_metrics = extraMetrics;
      }

      await api.post(`/posts/${postId}/confirm`, payload);
      onConfirm(payload);
    } catch (err) {
      setError(
        err.response?.data?.error ||
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
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
            Confiança da extração:
          </span>
          <ConfidenceBadge confidence={confidence} />
        </div>

        {/* AI extraction failed */}
        {aiError && (
          <div className="alert alert-error" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <IconAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              A IA não conseguiu analisar os prints automaticamente
              {/^ANTHROPIC_API_KEY/.test(aiError)
                ? ' (a chave da Anthropic não está configurada no servidor).'
                : `: ${aiError}.`}
              {' '}Preencha as métricas manualmente abaixo.
            </span>
          </div>
        )}

        {/* Low confidence warning */}
        {confidence === 'low' && !aiError && (
          <div className="alert alert-error" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <IconAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              A IA não extraiu as métricas com alta confiança. Revise e corrija os valores manualmente antes de confirmar.
            </span>
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
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {editMode
              ? <><IconLock size={13} /> Bloquear campos</>
              : <><IconPencil size={13} /> Editar manualmente</>
            }
          </button>
        </div>

        {/* Standard metrics grid */}
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

        {/* Extra AI-detected metrics */}
        {extraKeys.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Métricas adicionais detectadas pela IA
            </p>
            <div className={styles.metricsGrid}>
              {extraKeys.map((key) => (
                <div key={key} className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">{formatExtraLabel(key)}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={values[`${EXTRA_PREFIX}${key}`] ?? ''}
                    onChange={(e) => handleChange(`${EXTRA_PREFIX}${key}`, e.target.value)}
                    readOnly={!editMode}
                    style={!editMode ? { background: 'var(--surface)', cursor: 'default' } : {}}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
              'Confirmar Métricas'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
