import React from 'react';
import styles from './MetricCard.module.css';

function formatValue(value, unit) {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  if (unit === '%') {
    return `${num.toFixed(2)}%`;
  }

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return num.toLocaleString('pt-BR');
}

function formatChange(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return pct;
}

export default function MetricCard({ label, value, unit, previousValue, icon }) {
  const change = previousValue !== undefined ? formatChange(value, previousValue) : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>
        {formatValue(value, unit)}
      </div>
      {change !== null && (
        <div className={`${styles.change} ${change >= 0 ? styles.positive : styles.negative}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs mês anterior
        </div>
      )}
    </div>
  );
}
