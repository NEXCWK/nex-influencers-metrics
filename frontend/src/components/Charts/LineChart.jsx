import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function NexLineChart({ data = [], lines = [], xKey = 'month', title }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E5E5', borderRadius: 8, padding: '20px 24px' }}>
      {title && (
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'Arial, sans-serif' }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
          <XAxis
            dataKey={xKey}
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
          <Legend
            wrapperStyle={{ fontSize: 12, fontFamily: 'Arial, sans-serif', paddingTop: 12 }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || '#000'}
              strokeWidth={2}
              dot={{ r: 3, fill: line.color || '#000', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
