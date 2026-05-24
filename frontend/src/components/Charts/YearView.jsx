import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
        <p key={entry.dataKey} style={{ margin: '2px 0', color: '#000' }}>
          {entry.name}: <strong>
            {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

/**
 * Props:
 *  data: array of 12 objects { month: 'Jan', reach: 12000, engagement_rate: 3.5, ... }
 */
export default function YearView({ data = [] }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E5E5', borderRadius: 8, padding: '20px 24px' }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'Arial, sans-serif' }}>
        Visão Anual — Alcance
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#000000" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#000000" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
          <XAxis
            dataKey="month"
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
          <Area
            type="monotone"
            dataKey="reach"
            name="Alcance"
            stroke="#000000"
            strokeWidth={2}
            fill="url(#reachGradient)"
            dot={{ r: 3, fill: '#000', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
