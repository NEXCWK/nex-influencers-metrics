'use strict';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Nex brand tokens (frontend/src/styles/nex-tokens.css), inlined as hex —
// email clients don't support CSS custom properties.
const COLORS = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkSoft: '#3A3A3A',
  inkMuted: '#8A8A85',
  accent: '#FFD400',
  border: '#ECEAE2',
  success: '#1F8A4C',
  successBg: '#DCFCE7',
  danger: '#B42318',
  dangerBg: '#FEE2E2',
};

const VERDICT_LABEL = {
  melhora: { text: 'Mês de crescimento', color: COLORS.success, bg: COLORS.successBg },
  queda: { text: 'Mês de queda', color: COLORS.danger, bg: COLORS.dangerBg },
  misto: { text: 'Resultados mistos', color: '#92640A', bg: '#FEF9C3' },
  estavel: { text: 'Resultados estáveis', color: COLORS.inkMuted, bg: COLORS.border },
  novo: { text: 'Primeiro mês com dados', color: COLORS.inkMuted, bg: COLORS.border },
  sem_posts: { text: 'Sem posts no mês', color: COLORS.danger, bg: COLORS.dangerBg },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function varBadge(pct) {
  if (pct === null || pct === undefined) {
    return `<span style="color:${COLORS.inkMuted};font-size:12px;">—</span>`;
  }
  const positive = pct >= 0;
  const color = positive ? COLORS.success : COLORS.danger;
  const bg = positive ? COLORS.successBg : COLORS.dangerBg;
  const arrow = positive ? '▲' : '▼';
  const sign = positive ? '+' : '';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;">${arrow} ${sign}${pct.toFixed(0)}%</span>`;
}

function metricCell(label, value, pct) {
  return `
    <td style="padding:10px 14px;border:1px solid ${COLORS.border};text-align:left;vertical-align:top;">
      <div style="font-size:11px;color:${COLORS.inkMuted};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">${esc(label)}</div>
      <div style="font-size:18px;font-weight:700;color:${COLORS.ink};margin-bottom:4px;">${fmtNum(value)}</div>
      ${varBadge(pct)}
    </td>`;
}

function trendSparkline(trend, field) {
  const vals = trend.map((t) => (t.metrics ? Number(t.metrics[field] ?? 0) : 0));
  const max = Math.max(...vals, 1);
  const cells = trend.map((t, i) => {
    const v = vals[i];
    const height = Math.max(4, Math.round((v / max) * 28));
    const label = `${MONTHS_PT[t.month - 1].slice(0, 3)}`;
    return `
      <td style="text-align:center;padding:0 6px;vertical-align:bottom;">
        <div style="width:20px;height:${height}px;background:${COLORS.accent};border-radius:3px;margin:0 auto;"></div>
        <div style="font-size:9px;color:${COLORS.inkMuted};margin-top:4px;">${label}</div>
      </td>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${cells}</tr></table>`;
}

function influencerSection(inf) {
  const verdict = VERDICT_LABEL[inf.verdict] || VERDICT_LABEL.estavel;
  const c = inf.current || {};
  const v = inf.variation || {};

  const insightsHtml = inf.insights
    .map((text) => `<li style="margin-bottom:6px;color:${COLORS.inkSoft};font-size:13px;line-height:1.5;">${esc(text)}</li>`)
    .join('');

  const metricsRow = inf.hasData ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:16px;">
      <tr>
        ${metricCell('Posts', c.post_count, v.post_count)}
        ${metricCell('Alcance', c.reach, v.reach)}
        ${metricCell('Visualizações', c.impressions, v.impressions)}
        ${metricCell('Curtidas', c.likes, v.likes)}
      </tr>
      <tr>
        ${metricCell('Comentários', c.comments, v.comments)}
        ${metricCell('Compart.', c.shares, v.shares)}
        ${metricCell('Salvamentos', c.saves, v.saves)}
        ${metricCell('Feed / Story', `${inf.feedCount} / ${inf.storyCount}`, null)}
      </tr>
    </table>
  ` : '';

  const trendHtml = inf.hasData ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;color:${COLORS.inkMuted};text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Tendência de alcance (últimos 4 meses)</div>
      ${trendSparkline(inf.trend, 'reach')}
    </div>
  ` : '';

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;margin-bottom:20px;">
    <tr>
      <td style="padding:20px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="font-size:16px;font-weight:700;color:${COLORS.ink};">${esc(inf.name)}</td>
            <td align="right">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${verdict.bg};color:${verdict.color};font-size:12px;font-weight:700;">${verdict.text}</span>
            </td>
          </tr>
        </table>
        ${metricsRow}
        ${trendHtml}
        <ul style="margin:0;padding-left:18px;">${insightsHtml}</ul>
      </td>
    </tr>
  </table>`;
}

/**
 * Renders the full monthly report as a standalone HTML email.
 * @param {object} report - output of buildMonthlyReport()
 */
function renderMonthlyReportHtml(report) {
  const monthLabel = `${MONTHS_PT[report.month - 1]} de ${report.year}`;
  const sections = report.influencers.map(influencerSection).join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório mensal — ${esc(monthLabel)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Proxima Nova', Arial, Helvetica, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLORS.bg};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
          <tr>
            <td style="padding:8px 8px 24px 8px;">
              <div style="display:inline-block;background:${COLORS.accent};color:${COLORS.ink};font-weight:800;font-size:13px;padding:4px 10px;border-radius:6px;margin-bottom:12px;">NEX</div>
              <h1 style="margin:0;font-size:22px;color:${COLORS.ink};">Relatório Mensal de Performance</h1>
              <p style="margin:6px 0 0 0;color:${COLORS.inkMuted};font-size:13px;">Referente a ${esc(monthLabel)} — período completo</p>
            </td>
          </tr>
          <tr>
            <td>
              ${sections || `<p style="color:${COLORS.inkMuted};font-size:13px;">Nenhum influenciador ativo encontrado.</p>`}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px;color:${COLORS.inkMuted};font-size:11px;">
              Relatório gerado automaticamente pelo Nex Influencer Metrics em ${new Date(report.generatedAt).toLocaleString('pt-BR')}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderMonthlyReportHtml };
