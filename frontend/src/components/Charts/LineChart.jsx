import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartCard, ChartTooltip, axisProps, yTickFormatter, CHART_COLORS } from './theme.jsx';

export default function NexLineChart({ data = [], lines = [], xKey = 'month', title, subtitle }) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={lines.map((l) => ({ label: l.name, color: l.color || CHART_COLORS.primary }))}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} dy={6} />
          <YAxis {...axisProps} tickFormatter={yTickFormatter} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#A3A3A3', strokeDasharray: '3 3' }} />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
