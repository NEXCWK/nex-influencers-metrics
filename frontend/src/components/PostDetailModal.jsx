import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { Modal, Skeleton } from './ui.jsx';
import { FormatBadge, PlatformLabel, PostLink, DuplicateBadge } from './PostBadges.jsx';
import { IconChevronLeft, IconChevronRight, IconImage } from './Icons.jsx';
import { formatDate, formatInt } from '../utils/format.js';

/**
 * Admin post viewer: every stored print (carousel) + the post's metrics.
 * `actions` renders extra buttons in the footer (e.g. Editar / Re-extrair).
 */
export default function PostDetailModal({ post, onClose, actions }) {
  const [prints, setPrints] = useState([]);
  const [printIdx, setPrintIdx] = useState(0);
  const [loadingPrints, setLoadingPrints] = useState(true);

  useEffect(() => {
    if (!post) return;
    let mounted = true;
    setLoadingPrints(true);
    setPrintIdx(0);
    api.get(`/admin/posts/${post.id}/prints`)
      .then((res) => mounted && setPrints(res.data?.prints || (post.image_url ? [post.image_url] : [])))
      .catch(() => mounted && setPrints(post.image_url ? [post.image_url] : []))
      .finally(() => mounted && setLoadingPrints(false));
    return () => { mounted = false; };
  }, [post]);

  if (!post) return null;

  const isStory = post.post_type === 'story';
  const details = [
    ['Visualizações', post.impressions, true],
    ['Curtidas', post.likes],
    ['Alcance', post.reach],
    ['Comentários', post.comments],
    ['Compartilhamentos', post.shares],
    ['Plays', post.plays, true],
    ['Salvamentos', post.saves, true],
    ['Visitas ao perfil', post.profile_visits],
    ['Cliques no link', post.link_clicks],
    // Visualizações/Plays/Salvamentos só existem em posts de Feed —
    // não aparecem (nem zerados) no detalhamento de um Story.
  ].filter(([, , feedOnly]) => !(isStory && feedOnly));

  const extraMetrics = post.extra_metrics && typeof post.extra_metrics === 'object'
    ? Object.entries(post.extra_metrics)
    : [];

  return (
    <Modal
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {post.title || 'Post'} <PostLink url={post.post_url} />
        </span>
      )}
      subtitle={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {post.influencer_name && <strong style={{ color: 'var(--ink)' }}>{post.influencer_name}</strong>}
          <PlatformLabel platform={post.platform} />
          <FormatBadge type={post.post_type} />
          <span>{formatDate(post.published_date || post.created_at)}</span>
          {post.possible_duplicate && <DuplicateBadge />}
        </span>
      )}
      onClose={onClose}
      maxWidth={880}
      footer={(
        <>
          {actions}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </>
      )}
    >
      <div className="detail-grid">
        <div>
          {loadingPrints ? (
            <Skeleton height={380} />
          ) : prints.length > 0 ? (
            <>
              <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={prints[printIdx]}
                  alt={`Print ${printIdx + 1}`}
                  style={{ width: '100%', objectFit: 'contain', maxHeight: '58vh', display: 'block' }}
                />
              </div>
              {prints.length > 1 && (
                <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={printIdx === 0} onClick={() => setPrintIdx((i) => i - 1)}>
                    <IconChevronLeft size={14} /> Anterior
                  </button>
                  <span className="muted tabular" style={{ fontSize: 13 }}>{printIdx + 1} / {prints.length}</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={printIdx === prints.length - 1} onClick={() => setPrintIdx((i) => i + 1)}>
                    Próximo <IconChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state card-empty">
              <div className="empty-state-icon"><IconImage size={20} /></div>
              <p className="empty-state-text">Nenhum print disponível.</p>
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Métricas</p>
          <div className="kv-grid kv-grid-2">
            {details.map(([label, val]) => (
              <div key={label} className="kv">
                <span className="kv-label">{label}</span>
                <span className="kv-value">{val == null ? '—' : formatInt(val)}</span>
              </div>
            ))}
          </div>

          {extraMetrics.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: '18px 0 10px' }}>Métricas adicionais (IA)</p>
              <div className="kv-grid kv-grid-2">
                {extraMetrics.map(([key, val]) => (
                  <div key={key} className="kv">
                    <span className="kv-label">{key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}</span>
                    <span className="kv-value">{val == null ? '—' : (typeof val === 'object' ? JSON.stringify(val) : String(val))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
