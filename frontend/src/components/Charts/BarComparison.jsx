import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E5E5',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#000' }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.fill === '#000000' ? '#000' : '#888', margin: '2px 0' }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

/**
 * Props:
 *  currentData:  { reach: 12000, likes: 500, ... }
 *  previousData: { reach: 10000, likes: 450, ... }
 *  metrics: [{ key: 'reach', label: 'Alcance' }, ...]
 */
export default function BarComparison({ currentData = {}, previousData = {}, metrics = [] }) {
  const chartData = metrics.map((m) => ({
    name: m.label,
    'Mês Atual': currentData[m.key] ?? 0,
    'Mês Anterior': previousData[m.key] ?? 0,
  }));

  return (
    <div style={{ background: 'white', border: '1px solid #E5E5E5', borderRadius: 8, padding: '20px 24px' }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'Arial, sans-serif' }}>
        Comparativo — Mês Atual vs Anterior
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fontFamily: 'Arial, sans-serif', fill: '#2A2A2A' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fontFamily: 'Arial, sans-serif', fill: '#2A2A2A' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return v;
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Arial, sans-serif', paddingTop: 12 }} />
          <Bar dataKey="Mês Atual" fill="#000000" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Bar dataKey="Mês Anterior" fill="#E5E5E5" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
