import React from 'react';

// Small pill showing whether a post is a Feed post or a Story.
export function FormatBadge({ type }) {
  const isStory = type === 'story';
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        color: isStory ? '#7c3aed' : '#0369a1',
        background: isStory ? 'rgba(124,58,237,0.08)' : 'rgba(3,105,161,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {isStory ? 'Story' : 'Feed'}
    </span>
  );
}

// Warning tag shown to admins on posts that may be duplicates.
export function DuplicateBadge() {
  return (
    <span
      title="Possível duplicado — mesmo número de visualizações/alcance de outro post do mesmo influenciador"
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: '#b45309',
        background: 'rgba(245,158,11,0.15)',
        border: '1px solid rgba(245,158,11,0.4)',
        whiteSpace: 'nowrap',
      }}
    >
      ⚠ possível duplicado
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
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', color: 'var(--ink-muted)', flexShrink: 0 }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
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
        style={{ color: 'var(--ink-muted)', cursor: 'help' }}
      >
        —
      </span>
    );
  }
  return <>{format ? format(value) : value}</>;
}
