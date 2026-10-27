// ---------------------------------------------------------------------------
// Shared formatting helpers (numbers, dates, month names) used across pages.
// ---------------------------------------------------------------------------

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export function platformLabel(value) {
  return PLATFORMS.find((p) => p.value === value)?.label || value || '—';
}

export function currentYear() {
  return new Date().getFullYear();
}

export function currentMonth() {
  return new Date().getMonth() + 1;
}

// The 4 most recent years, newest first (used by every year selector).
export function yearOptions(count = 4) {
  const y = currentYear();
  return Array.from({ length: count }, (_, i) => y - i);
}

// Today's date as YYYY-MM-DD in the user's LOCAL timezone.
// (toISOString() is UTC: in Brazil, after 21h it already returns tomorrow.)
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Compact number: 1.234 → "1,2K"; 2.500.000 → "2,5M".
export function formatCompact(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
}

export function formatInt(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('pt-BR');
}

export function formatBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Dates stored as plain "YYYY-MM-DD" (e.g. posts.published_at) are calendar
// dates, not instants. `new Date('2026-03-01')` parses them as UTC midnight,
// which renders as 28/02 in Brazil (UTC-3) — so parse them as local dates.
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = parseDate(value);
  return d ? d.toLocaleDateString('pt-BR') : String(value);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = parseDate(value);
  return d
    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : String(value);
}

export function relativeTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export function initialOf(name) {
  return ((name || 'U').trim()[0] || 'U').toUpperCase();
}

export function plural(n, singular, pluralForm) {
  return `${n} ${n === 1 ? singular : (pluralForm || `${singular}s`)}`;
}
