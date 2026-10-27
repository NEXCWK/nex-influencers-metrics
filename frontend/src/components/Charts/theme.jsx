import React from 'react';
import { formatCompact } from '../../utils/format.js';

// Shared chart styling (Nex: preto como série principal, amarelo como acento,
// grades discretas em #E5E5E5). The yellow is darkened for lines/bars so the
// mark stays visible on white; identity is always also given by the legend
// and the tooltip, never by color alone.
export const CHART_COLORS = {
  primary: '#111111',
  accent: '#D9A400',
  muted: '#D4D4D4',
  grid: '#EDEDED',
  axis: '#6B6B6B',
};

export const axisProps = {
  tick: { fontSize: 12, fontFamily: 'Proxima Nova, Inter, sans-serif', fill: CHART_COLORS.axis },
  axisLine: false,
  tickLine: false,
};

export const yTickFormatter = (v) => (v === 0 ? '0' : formatCompact(v));

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E5E5',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 13,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 12px 32px -8px rgba(0,0,0,0.18)',
      minWidth: 150,
    }}>
      <p style={{ fontFamily: 'Proxima Nova, Inter, sans-serif', fontWeight: 700, marginBottom: 6, color: '#000' }}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0', color: '#2A2A2A' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color || entry.fill, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{entry.name}</span>
          <strong style={{ color: '#000', fontVariantNumeric: 'tabular-nums' }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

// Card frame with title + an always-visible legend (identity is never color-only).
export function ChartCard({ title, subtitle, legend = [], children }) {
  return (
    <div className="card" style={{ padding: '20px 20px 12px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p className="card-title">{title}</p>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {legend.length > 1 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {legend.map((l) => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Proxima Nova, Inter, sans-serif', fontWeight: 600, color: '#2A2A2A' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
