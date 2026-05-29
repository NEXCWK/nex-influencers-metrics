import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import { IconTicket, IconKey } from '../components/Icons.jsx';
import styles from './Coupons.module.css';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function Stepper({ value, onChange, disabled }) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange(Math.max(0, (parseInt(value, 10) || 0) - 1))}
        disabled={disabled || parseInt(value, 10) <= 0}
        aria-label="Diminuir"
      >
        -
      </button>
      <span className={styles.stepperVal}>{value ?? 0}</span>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange((parseInt(value, 10) || 0) + 1)}
        disabled={disabled}
        aria-label="Aumentar"
      >
        +
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
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const rowsRef = useRef([]);
  const saveTimers = useRef({});

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const saveRow = useCallback(async (row) => {
    setSavingId(row.user_id);
    setSavedId(null);
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
      // silent fail — user can retry by changing a value again
    } finally {
      setSavingId((id) => id === row.user_id ? null : id);
    }
  }, [year, month]);

  const fetchData = useCallback(async () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
    saveTimers.current = {};
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/coupons/admin', { params: { month, year } });
      setRows(res.data?.rows || []);
    } catch {
      setError('Erro ao carregar cupons.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

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

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) yearOptions.push(y);

  const totals = rows.reduce(
    (acc, r) => ({
      gallery: acc.gallery + (Number(r.gallery_count) || 0),
      atrium: acc.atrium + (Number(r.atrium_count) || 0),
      access: acc.access + (Number(r.access_count) || 0),
    }),
    { gallery: 0, atrium: 0, access: 0 },
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cupons</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-control" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <p className={styles.subtitle}>
        Registre quantas vezes cada cupom foi utilizado em {MONTHS[month - 1]}/{year}.
      </p>

      {!loading && rows.length > 0 && (
        <div className={styles.totalsRow}>
          <div className={styles.totalCard}>
            <span className={styles.totalLabel}>Total Gallery</span>
            <span className={styles.totalValue}>{totals.gallery}</span>
          </div>
          <div className={styles.totalCard}>
            <span className={styles.totalLabel}>Total Atrium</span>
            <span className={styles.totalValue}>{totals.atrium}</span>
          </div>
          <div className={styles.totalCard}>
            <span className={styles.totalLabel}>Total Access</span>
            <span className={styles.totalValue}>{totals.access}</span>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Influenciador</th>
                <th style={{ textAlign: 'center' }}>Assinatura Gallery</th>
                <th style={{ textAlign: 'center' }}>Assinatura Atrium</th>
                <th style={{ textAlign: 'center' }}>Cupom Access</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>Nenhum influenciador ativo.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.user_id}>
                  <td style={{ fontWeight: 600 }}>{row.display_name || row.username}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Stepper
                      value={row.gallery_count ?? 0}
                      onChange={(v) => updateField(row.user_id, 'gallery_count', v)}
                      disabled={savingId === row.user_id}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Stepper
                      value={row.atrium_count ?? 0}
                      onChange={(v) => updateField(row.user_id, 'atrium_count', v)}
                      disabled={savingId === row.user_id}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Stepper
                      value={row.access_count ?? 0}
                      onChange={(v) => updateField(row.user_id, 'access_count', v)}
                      disabled={savingId === row.user_id}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {savingId === row.user_id && (
                      <span className={styles.savingDot} title="Salvando..." />
                    )}
                    {savedId === row.user_id && savingId !== row.user_id && (
                      <span className={styles.savedCheck}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Salvo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className={styles.tableFooter}>
                  <td>Total</td>
                  <td style={{ textAlign: 'center' }}>{totals.gallery}</td>
                  <td style={{ textAlign: 'center' }}>{totals.atrium}</td>
                  <td style={{ textAlign: 'center' }}>{totals.access}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function InfluencerCoupons() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/coupons', { params: { month: CURRENT_MONTH, year: CURRENT_YEAR } }),
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
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Meus Cupons</h1>
      </div>

      <p className={styles.subtitle}>
        Cupons contabilizados para o seu perfil em {MONTHS[CURRENT_MONTH - 1]}/{CURRENT_YEAR}.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="metrics-grid">
        {loading ? (
          <>
            <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
          </>
        ) : (
          <>
            <MetricCard label="Assinatura Gallery" value={current?.gallery_count ?? 0} icon={<IconTicket size={16} />} />
            <MetricCard label="Assinatura Atrium" value={current?.atrium_count ?? 0} icon={<IconTicket size={16} />} />
            <MetricCard label="Cupom Access" value={current?.access_count ?? 0} icon={<IconKey size={16} />} />
          </>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <h2 className="section-title">Historico mensal</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        ) : history.length === 0 ? (
          <div className={styles.empty}>Nenhum cupom contabilizado ainda.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Assinatura Gallery</th>
                  <th>Assinatura Atrium</th>
                  <th>Cupom Access</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.year}-${h.month}`}>
                    <td style={{ fontWeight: 600 }}>{MONTHS[h.month - 1]}/{h.year}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.gallery_count ?? 0}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.atrium_count ?? 0}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.access_count ?? 0}</td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {(h.gallery_count ?? 0) + (h.atrium_count ?? 0) + (h.access_count ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
