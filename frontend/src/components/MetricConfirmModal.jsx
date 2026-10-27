import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { IconAlert, IconPencil, IconLock, IconSparkles } from './Icons.jsx';
import { FormatBadge } from './PostBadges.jsx';
import { Modal, Spinner } from './ui.jsx';
import styles from './MetricConfirmModal.module.css';

const METRIC_FIELDS = [
  { key: 'impressions', label: 'Visualizações', feedOnly: true },
  { key: 'likes', label: 'Curtidas' },
  { key: 'reach', label: 'Alcance (contas alcançadas)' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saves', label: 'Salvamentos', feedOnly: true },
  { key: 'plays', label: 'Reproduções (vídeo)', feedOnly: true },
  { key: 'engagement_rate', label: 'Taxa de engajamento (%)', feedOnly: true },
  { key: 'profile_visits', label: 'Visitas ao perfil' },
  { key: 'link_clicks', label: 'Cliques no link' },
];

const EXTRA_PREFIX = 'extra__';
const EMPTY = {};

function formatExtraLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ConfidenceBadge({ confidence }) {
  if (confidence === 'high') {
    return <span className="badge badge-success"><span className="dot" />Alta confiança</span>;
  }
  if (confidence === 'medium') {
    return <span className="badge badge-warning"><span className="dot" />Confiança média</span>;
  }
  return <span className="badge badge-danger"><span className="dot" />Baixa confiança</span>;
}

/**
 * Props:
 *  isOpen: bool
 *  metrics: object with metric values extracted by AI (including optional .extra{})
 *  postId: string/number
 *  postType: 'feed' | 'story' — detected format; hides fields that don't
 *    apply to that format (e.g. Visualizações/Plays/Salvamentos for a story)
 *  progressLabel: optional string shown above the title (e.g. "Post 2 de 5")
 *  previewUrl: optional local preview of the print being confirmed
 *  confidence: 'high' | 'medium' | 'low'
 *  notes: string (AI notes/observations)
 *  aiError: string
 *  onConfirm: (confirmedMetrics) => void
 *  onClose: () => void
 */
export default function MetricConfirmModal({
  isOpen,
  metrics,
  postId,
  postType,
  progressLabel,
  previewUrl,
  confidence,
  notes,
  aiError,
  onConfirm,
  onClose,
}) {
  const source = metrics || EMPTY;
  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState({});
  const [extraKeys, setExtraKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleFields = METRIC_FIELDS.filter((f) => postType !== 'story' || !f.feedOnly);

  // Re-initialize the form for each post in the queue (keyed by postId so a
  // parent re-render passing a fresh `{}` never wipes what the user typed).
  useEffect(() => {
    if (!isOpen) return;
    const init = {};
    METRIC_FIELDS.forEach(({ key }) => {
      init[key] = source[key] !== undefined && source[key] !== null ? String(source[key]) : '';
    });

    const extra = source.extra || {};
    const ek = Object.keys(extra);
    ek.forEach((key) => {
      const val = extra[key];
      init[`${EXTRA_PREFIX}${key}`] = val !== undefined && val !== null ? String(val) : '';
    });

    setValues(init);
    setExtraKeys(ek);
    setEditMode(confidence === 'low' || !!aiError || !metrics);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

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

      try {
        await api.post(`/posts/${postId}/confirm`, payload);
      } catch (err) {
        // Backend flagged a possible duplicate (same influencer + plataforma +
        // mesmo número de visualizações/alcance). Ask before proceeding.
        if (err.response?.status === 409 && err.response.data?.duplicate) {
          const ex = err.response.data.existing || {};
          const quando = ex.published_at ? ` (de ${ex.published_at})` : '';
          const proceed = window.confirm(
            `Já existe um post seu com o mesmo número de visualizações/alcance` +
            `${ex.title ? `: "${ex.title}"${quando}` : quando}.\n\n` +
            `Isso pode ser um post duplicado. Deseja enviar mesmo assim?`
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
          // Reenvia confirmando o envio; o post será marcado como possível duplicado.
          await api.post(`/posts/${postId}/confirm`, { ...payload, acknowledge_duplicate: true });
        } else {
          throw err;
        }
      }
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

  const renderInput = (key, label, type = 'number') => (
    <div key={key} className="form-group">
      <label className="form-label" htmlFor={`confirm-${key}`}>{label}</label>
      <input
        id={`confirm-${key}`}
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        step={type === 'number' ? (key === 'engagement_rate' ? '0.01' : '1') : undefined}
        min={type === 'number' ? '0' : undefined}
        className={`form-control ${!editMode ? styles.locked : ''}`}
        value={values[key] ?? ''}
        onChange={(e) => handleChange(key, e.target.value)}
        readOnly={!editMode}
      />
    </div>
  );

  return (
    <Modal
      eyebrow={progressLabel}
      title="Confirme as métricas"
      onClose={onClose}
      maxWidth={previewUrl ? 920 : 640}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Pular por agora
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? <><Spinner /> Salvando...</> : 'Confirmar métricas'}
          </button>
        </>
      )}
    >
      <div className={previewUrl ? styles.layout : undefined}>
        {previewUrl && (
          <div className={styles.preview}>
            <img src={previewUrl} alt="Print enviado" />
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          {/* Format detected + confidence */}
          <div className={styles.confidenceRow}>
            {postType && (
              <span className={styles.metaItem}>
                Formato <FormatBadge type={postType} />
              </span>
            )}
            <span className={styles.metaItem}>
              Leitura da IA <ConfidenceBadge confidence={confidence} />
            </span>
          </div>

          {/* AI extraction failed */}
          {aiError && (
            <div className="alert alert-error">
              <IconAlert size={16} />
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
            <div className="alert alert-warning">
              <IconAlert size={16} />
              <span>
                A IA não extraiu as métricas com alta confiança. Revise e corrija os valores antes de confirmar.
              </span>
            </div>
          )}

          {/* AI notes */}
          {notes && (
            <div className="alert alert-info">
              <IconSparkles size={16} />
              <span><strong>Observação da IA:</strong> {notes}</span>
            </div>
          )}

          <div className="row-between" style={{ marginBottom: 12 }}>
            <p className="eyebrow">Métricas extraídas</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode
                ? <><IconLock size={13} /> Bloquear campos</>
                : <><IconPencil size={13} /> Editar manualmente</>}
            </button>
          </div>

          <div className="form-grid">
            {visibleFields.map(({ key, label }) => renderInput(key, label))}
          </div>

          {/* Extra AI-detected metrics */}
          {extraKeys.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: '8px 0 12px' }}>Métricas adicionais detectadas pela IA</p>
              <div className="form-grid">
                {extraKeys.map((key) => renderInput(`${EXTRA_PREFIX}${key}`, formatExtraLabel(key), 'text'))}
              </div>
            </>
          )}

          {error && <div className="alert alert-error" style={{ marginTop: 4, marginBottom: 0 }}>{error}</div>}
        </div>
      </div>
    </Modal>
  );
}
