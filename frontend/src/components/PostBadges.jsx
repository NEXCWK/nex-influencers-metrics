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
