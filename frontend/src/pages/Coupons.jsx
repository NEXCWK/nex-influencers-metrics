import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import { IconTicket, IconKey, IconCheck, IconAlert, IconMinus, IconPlus } from '../components/Icons.jsx';
import { PageHeader, Segmented, MonthSelect, YearSelect, EmptyState, Skeleton, SectionHeader } from '../components/ui.jsx';
import { MONTHS, currentMonth, currentYear } from '../utils/format.js';
import styles from './Coupons.module.css';

function Stepper({ value, onChange, disabled, label }) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange(Math.max(0, (parseInt(value, 10) || 0) - 1))}
        disabled={disabled || parseInt(value, 10) <= 0}
        aria-label={`Diminuir ${label}`}
      >
        <IconMinus size={14} />
      </button>
      <span className={styles.stepperVal} aria-live="polite">{value ?? 0}</span>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange((parseInt(value, 10) || 0) + 1)}
        disabled={disabled}
        aria-label={`Aumentar ${label}`}
      >
        <IconPlus size={14} />
      </button>
    </div>
  );
}

export default function Coupons() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return isAdmin ? <AdminCoupons /> : <InfluencerCoupons />;
}

function AdminCoupons() {
  const [view, setView] = useState('month'); // 'month' | 'year'
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [failedId, setFailedId] = useState(null);

  const rowsRef = useRef([]);
  const saveTimers = useRef({});

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const saveRow = useCallback(async (row) => {
    setSavingId(row.user_id);
    setSavedId(null);
    setFailedId((id) => (id === row.user_id ? null : id));
    try {
      await api.put(`/coupons/admin/${row.user_id}`, {
        year,
        month,
        gallery_count: Number(row.gallery_count) || 0,
        atrium_count: Number(row.atrium_count) || 0,
        access_count: Number(row.access_count) || 0,
      });
      setSavedId(row.user_id);
      setTimeout(() => setSavedId((id) => id === row.user_id ? null : id), 2000);
    } catch {
      // Flag the row so the admin knows the value wasn't persisted; changing
      // any value again retries the save.
      setFailedId(row.user_id);
    } finally {
      setSavingId((id) => id === row.user_id ? null : id);
    }
  }, [year, month]);

  const fetchData = useCallback(async () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
    saveTimers.current = {};
    setLoading(true);
    setError('');
    setFailedId(null);
    try {
      const res = view === 'year'
        ? await api.get('/coupons/admin/annual', { params: { year } })
        : await api.get('/coupons/admin', { params: { month, year } });
      setRows(res.data?.rows || []);
    } catch {
      setError('Erro ao carregar cupons.');
    } finally {
      setLoading(false);
    }
  }, [view, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateField = (userId, field, value) => {
    const v = Math.max(0, parseInt(value, 10) || 0);
    setRows((prev) => prev.map((r) => r.user_id === userId ? { ...r, [field]: v } : r));

    clearTimeout(saveTimers.current[userId]);
    saveTimers.current[userId] = setTimeout(() => {
      const row = rowsRef.current.find((r) => r.user_id === userId);
      if (row) saveRow({ ...row, [field]: v });
    }, 800);
  };

  const totals = rows.reduce(
    (acc, r) => ({
      gallery: acc.gallery + (Number(r.gallery_count) || 0),
      atrium: acc.atrium + (Number(r.atrium_count) || 0),
      access: acc.access + (Number(r.access_count) || 0),
    }),
    { gallery: 0, atrium: 0, access: 0 },
  );

  const periodLabel = view === 'year' ? String(year) : `${MONTHS[month - 1]}/${year}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Cupons' }]}
        title="Contagem mensal"
        subtitle={view === 'year'
          ? `Total de cupons utilizados somando todos os meses de ${year}.`
          : `Registre quantas vezes cada cupom foi utilizado em ${MONTHS[month - 1]}/${year}. As alterações são salvas automaticamente.`}
        actions={(
          <>
            <Segmented
              ariaLabel="Visualização"
              value={view}
              onChange={setView}
              options={[{ value: 'month', label: 'Mensal' }, { value: 'year', label: 'Anual' }]}
            />
            {view === 'month' && <MonthSelect value={month} onChange={setMonth} style={{ width: 'auto' }} />}
            <YearSelect value={year} onChange={setYear} style={{ width: 'auto' }} />
          </>
        )}
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        {loading ? (
          <><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /></>
        ) : (
          <>
            <MetricCard label="Assinatura Gallery" value={totals.gallery} unit="raw" icon={<IconTicket size={16} />} hint={periodLabel} />
            <MetricCard label="Assinatura Atrium" value={totals.atrium} unit="raw" icon={<IconTicket size={16} />} hint={periodLabel} />
            <MetricCard label="Cupom Access" value={totals.access} unit="raw" icon={<IconKey size={16} />} hint={periodLabel} highlight />
          </>
        )}
      </div>

      {loading ? (
        <Skeleton height={300} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Influenciador</th>
                <th className="text-center">Assinatura Gallery</th>
                <th className="text-center">Assinatura Atrium</th>
                <th className="text-center">Cupom Access</th>
                {view === 'month' && <th style={{ width: 110 }}><span className="sr-only">Status</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={view === 'month' ? 5 : 4} style={{ padding: 0 }}>
                    <EmptyState icon={<IconTicket size={20} />} title="Nenhum influenciador ativo" />
                  </td>
                </tr>
              ) : rows.map((row) => {
                const name = row.display_name || row.username;
                return (
                  <tr key={row.user_id}>
                    <td className="cell-title">{name}</td>
                    {view === 'year' ? (
                      <>
                        <td className="text-center tabular strong">{row.gallery_count ?? 0}</td>
                        <td className="text-center tabular strong">{row.atrium_count ?? 0}</td>
                        <td className="text-center tabular strong">{row.access_count ?? 0}</td>
                      </>
                    ) : (
                      <>
                        {['gallery_count', 'atrium_count', 'access_count'].map((field) => (
                          <td key={field} className="text-center">
                            <Stepper
                              label={`${field.replace('_count', '')} de ${name}`}
                              value={row[field] ?? 0}
                              onChange={(v) => updateField(row.user_id, field, v)}
                              disabled={savingId === row.user_id}
                            />
                          </td>
                        ))}
                        <td>
                          {savingId === row.user_id && (
                            <span className={styles.status}><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Salvando</span>
                          )}
                          {savedId === row.user_id && savingId !== row.user_id && (
                            <span className={`${styles.status} ${styles.saved}`}><IconCheck size={13} /> Salvo</span>
                          )}
                          {failedId === row.user_id && savingId !== row.user_id && (
                            <span className={`${styles.status} ${styles.failed}`} title="Não foi possível salvar. Altere o valor novamente para tentar de novo.">
                              <IconAlert size={13} /> Não salvo
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-center tabular">{totals.gallery}</td>
                  <td className="text-center tabular">{totals.atrium}</td>
                  <td className="text-center tabular">{totals.access}</td>
                  {view === 'month' && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}

function InfluencerCoupons() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const month = currentMonth();
  const year = currentYear();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/coupons', { params: { month, year } }),
      api.get('/coupons/history'),
    ])
      .then(([curRes, histRes]) => {
        if (!mounted) return;
        setCurrent(curRes.data);
        setHistory(histRes.data?.history || []);
      })
      .catch(() => mounted && setError('Erro ao carregar seus cupons.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [month, year]);

  return (
    <>
      <PageHeader
        title="Meus cupons"
        subtitle={`Cupons contabilizados para o seu perfil em ${MONTHS[month - 1]}/${year}.`}
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid">
        {loading ? (
          <><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /></>
        ) : (
          <>
            <MetricCard label="Assinatura Gallery" value={current?.gallery_count ?? 0} unit="raw" icon={<IconTicket size={16} />} />
            <MetricCard label="Assinatura Atrium" value={current?.atrium_count ?? 0} unit="raw" icon={<IconTicket size={16} />} />
            <MetricCard label="Cupom Access" value={current?.access_count ?? 0} unit="raw" icon={<IconKey size={16} />} highlight />
          </>
        )}
      </div>

      <section className="section">
        <SectionHeader title="Histórico mensal" />
        {loading ? (
          <Skeleton height={200} />
        ) : history.length === 0 ? (
          <EmptyState
            bordered
            icon={<IconTicket size={20} />}
            title="Nenhum cupom contabilizado ainda"
            text="Quando a equipe Nex registrar o uso dos seus cupons, o histórico aparece aqui."
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Assinatura Gallery</th>
                  <th className="num">Assinatura Atrium</th>
                  <th className="num">Cupom Access</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.year}-${h.month}`}>
                    <td className="cell-title">{MONTHS[h.month - 1]}/{h.year}</td>
                    <td className="num">{h.gallery_count ?? 0}</td>
                    <td className="num">{h.atrium_count ?? 0}</td>
                    <td className="num">{h.access_count ?? 0}</td>
                    <td className="num strong">
                      {(h.gallery_count ?? 0) + (h.atrium_count ?? 0) + (h.access_count ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
