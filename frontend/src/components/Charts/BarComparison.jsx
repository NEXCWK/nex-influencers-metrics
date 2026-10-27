import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartCard, ChartTooltip, axisProps, yTickFormatter, CHART_COLORS } from './theme.jsx';

/**
 * Props:
 *  currentData:  { reach: 12000, likes: 500, ... }
 *  previousData: { reach: 10000, likes: 450, ... }
 *  metrics: [{ key: 'reach', label: 'Alcance' }, ...]
 */
export default function BarComparison({ currentData = {}, previousData = {}, metrics = [], title = 'Mês selecionado vs. anterior' }) {
  const chartData = metrics.map((m) => ({
    name: m.label,
    'Mês selecionado': currentData[m.key] ?? 0,
    'Mês anterior': previousData[m.key] ?? 0,
  }));

  return (
    <ChartCard
      title={title}
      legend={[
        { label: 'Mês selecionado', color: CHART_COLORS.primary },
        { label: 'Mês anterior', color: CHART_COLORS.muted },
      ]}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} dy={6} />
          <YAxis {...axisProps} tickFormatter={yTickFormatter} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="Mês selecionado" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="Mês anterior" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
