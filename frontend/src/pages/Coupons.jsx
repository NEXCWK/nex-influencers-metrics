import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import styles from './Coupons.module.css';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

export default function Coupons() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return isAdmin ? <AdminCoupons /> : <InfluencerCoupons />;
}

// ───────────────────────────────────────────────────────────────────────────
// Admin: edit coupon counts per influencer per month
// ───────────────────────────────────────────────────────────────────────────
function AdminCoupons() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const fetchData = useCallback(async () => {
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
    const v = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, [field]: v } : r)));
  };

  const saveRow = async (row) => {
    setSavingId(row.user_id);
    setSavedId(null);
    try {
      await api.put(`/coupons/admin/${row.user_id}`, {
        year,
        month,
        subscription_count: Number(row.subscription_count) || 0,
        access_count: Number(row.access_count) || 0,
      });
      setSavedId(row.user_id);
      setTimeout(() => setSavedId(null), 2000);
    } catch {
      alert('Erro ao salvar.');
    } finally {
      setSavingId(null);
    }
  };

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 3; y--) yearOptions.push(y);

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
        Registre quantas vezes cada cupom foi utilizado por influenciador em {MONTHS[month - 1]}/{year}.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 8 }} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Influenciador</th>
                <th style={{ width: 170 }}>Cupom Assinatura</th>
                <th style={{ width: 170 }}>Cupom Access</th>
                <th style={{ width: 120 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: 32 }}>Nenhum influenciador ativo.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.user_id}>
                  <td style={{ fontWeight: 600 }}>{row.display_name || row.username}</td>
                  <td>
                    <input
                      type="number" min="0"
                      className="form-control"
                      value={row.subscription_count}
                      onChange={(e) => updateField(row.user_id, 'subscription_count', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0"
                      className="form-control"
                      value={row.access_count}
                      onChange={(e) => updateField(row.user_id, 'access_count', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveRow(row)}
                      disabled={savingId === row.user_id}
                    >
                      {savingId === row.user_id ? 'Salvando...' : savedId === row.user_id ? '✓ Salvo' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Influencer: own counts for current month + history
// ───────────────────────────────────────────────────────────────────────────
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
            <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
          </>
        ) : (
          <>
            <MetricCard label="Cupom Assinatura" value={current?.subscription_count ?? 0} icon="🎟️" />
            <MetricCard label="Cupom Access" value={current?.access_count ?? 0} icon="🔑" />
          </>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <h2 className="section-title">Histórico mensal</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : history.length === 0 ? (
          <div className={styles.empty}>Nenhum cupom contabilizado ainda.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Cupom Assinatura</th>
                  <th>Cupom Access</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.year}-${h.month}`}>
                    <td style={{ fontWeight: 600 }}>{MONTHS[h.month - 1]}/{h.year}</td>
                    <td>{h.subscription_count ?? 0}</td>
                    <td>{h.access_count ?? 0}</td>
                    <td style={{ fontWeight: 700 }}>{(h.subscription_count ?? 0) + (h.access_count ?? 0)}</td>
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
