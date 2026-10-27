import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartCard, ChartTooltip, axisProps, yTickFormatter, CHART_COLORS } from './theme.jsx';

/**
 * Props:
 *  data: array of 12 objects { month: 'Jan', reach: 12000, impressions: 30000, ... }
 *  year: number shown in the title
 */
export default function YearView({ data = [], year }) {
  return (
    <ChartCard
      title={`Visão anual${year ? ` — ${year}` : ''}`}
      subtitle="Soma mensal de visualizações e alcance"
      legend={[
        { label: 'Visualizações', color: CHART_COLORS.primary },
        { label: 'Alcance', color: CHART_COLORS.accent },
      ]}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="month" {...axisProps} dy={6} />
          <YAxis {...axisProps} tickFormatter={yTickFormatter} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="impressions" name="Visualizações" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="reach" name="Alcance" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
