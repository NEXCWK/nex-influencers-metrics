import React from 'react';
import { formatCompact, formatInt } from '../utils/format.js';
import { IconArrowUp, IconArrowDown } from './Icons.jsx';
import styles from './MetricCard.module.css';

function formatValue(value, unit) {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (unit === '%') return `${num.toFixed(2).replace('.', ',')}%`;
  if (unit === 'raw') return formatInt(num);
  return formatCompact(num);
}

function formatChange(current, previous) {
  if (previous === null || previous === undefined || Number(previous) === 0) return null;
  return ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100;
}

/**
 * KPI tile. `highlight` marks the primary metrics of a page (yellow icon);
 * `previousValue` adds the month-over-month change pill; `hint` is a small
 * caption under the value.
 */
export default function MetricCard({ label, value, unit, previousValue, icon, highlight, hint }) {
  const change = previousValue !== undefined ? formatChange(value, previousValue) : null;
  const exact = value != null && !isNaN(parseFloat(value)) && unit !== '%' ? formatInt(value) : undefined;

  return (
    <div className={`${styles.card} ${highlight ? styles.highlight : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.iconBadge}>{icon}</span>}
      </div>
      <div className={styles.value} title={exact}>
        {formatValue(value, unit)}
      </div>
      {change !== null ? (
        <div className={styles.footer}>
          <span className={`${styles.change} ${change >= 0 ? styles.positive : styles.negative}`}>
            {change >= 0 ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
            {Math.abs(change).toFixed(1).replace('.', ',')}%
          </span>
          <span className={styles.vs}>vs. mês anterior</span>
        </div>
      ) : hint ? (
        <div className={styles.footer}><span className={styles.vs}>{hint}</span></div>
      ) : null}
    </div>
  );
}
