import React from 'react';
import { IconExternal, IconAlert } from './Icons.jsx';
import { platformLabel } from '../utils/format.js';

// Small pill showing whether a post is a Feed post or a Story.
export function FormatBadge({ type }) {
  const isStory = type === 'story';
  return (
    <span className={`badge ${isStory ? 'badge-story' : 'badge-info'}`}>
      {isStory ? 'Story' : 'Feed'}
    </span>
  );
}

// Platform name with its brand-colored dot.
export function PlatformLabel({ platform }) {
  return <span className={`platform-label platform-${platform}`}>{platformLabel(platform)}</span>;
}

// Warning tag shown to admins on posts that may be duplicates.
export function DuplicateBadge() {
  return (
    <span
      className="badge badge-warning"
      title="Possível duplicado — mesmo número de visualizações/alcance de outro post do mesmo influenciador"
    >
      <IconAlert size={11} /> Possível duplicado
    </span>
  );
}

// Small clickable link icon shown next to a post's title when it has a post_url.
export function PostLink({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir o post original"
      aria-label="Abrir o post original"
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', color: 'var(--ink-muted)', flexShrink: 0 }}
    >
      <IconExternal size={13} />
    </a>
  );
}

// Renders a metric value, or a "—" with a tooltip explaining the absence.
export function MetricCell({ value, format }) {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'number' && isNaN(value));
  if (empty) {
    return (
      <span
        title="Métrica não disponível neste formato ou não informada no print"
        style={{ color: 'var(--ink-faint)', cursor: 'help' }}
      >
        —
      </span>
    );
  }
  return <>{format ? format(value) : value}</>;
}

// Thumbnail of a post's print (or a placeholder), optionally clickable.
export function PostThumb({ src, onClick }) {
  if (!src) {
    return (
      <span className="thumb-placeholder" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </span>
    );
  }
  if (onClick) {
    return (
      <button type="button" className="thumb-btn" onClick={onClick} aria-label="Ver print">
        <img src={src} alt="" className="thumb" loading="lazy" />
      </button>
    );
  }
  return <img src={src} alt="" className="thumb" loading="lazy" />;
}
