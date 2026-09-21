import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api.js';
import { IconDownload } from '../components/Icons.jsx';

const CATEGORY_LABEL = { fixo: 'Fixo', avulso: 'Avulso' };

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function toDateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sumSales(sales) {
  return sales.reduce(
    (acc, s) => ({
      count: acc.count + 1,
      paid: acc.paid + Number(s.amount_paid),
      commission: acc.commission + Number(s.commission_amount),
    }),
    { count: 0, paid: 0, commission: 0 }
  );
}

export default function AdminCouponPartners() {
  const [tab, setTab] = useState('dashboard');

  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migrationPending, setMigrationPending] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [partnersRes, salesRes] = await Promise.all([
        api.get('/admin/coupon-partners'),
        api.get('/admin/coupon-partners/sales'),
      ]);
      setPartners(partnersRes.data?.partners || []);
      setProducts(partnersRes.data?.products || []);
      setAllSales(salesRes.data?.sales || []);
      setMigrationPending(!!partnersRes.data?.migration_pending || !!salesRes.data?.migration_pending);
    } catch {
      setError('Erro ao carregar dados de cupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const productByKey = useMemo(() => {
    const m = {};
    products.forEach((p) => { m[p.key] = p; });
    return m;
  }, [products]);

  const partnerById = useMemo(() => {
    const m = {};
    partners.forEach((p) => { m[p.id] = p; });
    return m;
  }, [partners]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cupons Access Pass</h1>
        <button className="btn btn-secondary" onClick={fetchAll}>Atualizar</button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-muted)', fontFamily: 'var(--font)', marginBottom: 16, maxWidth: 680 }}>
        Registro de venda de Access Pass, Atrium e Gallery através dos cupons dos influenciadores parceiros.
        Acesso restrito a administradores.
      </p>

      {migrationPending && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          As tabelas de cupons ainda não existem no banco. Rode a migration 008_coupon_partners.sql no Supabase.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button className={`tab-btn ${tab === 'partners' ? 'active' : ''}`} onClick={() => setTab('partners')}>Parceiros</button>
        <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Registrar Cupom</button>
        <button className={`tab-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Relatórios</button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      ) : (
        <>
          {tab === 'dashboard' && <DashboardTab partners={partners} allSales={allSales} productByKey={productByKey} products={products} />}
          {tab === 'partners' && <PartnersTab partners={partners} onChanged={fetchAll} />}
          {tab === 'register' && <RegisterTab partners={partners} products={products} onSaved={fetchAll} />}
          {tab === 'reports' && <ReportsTab partners={partners} allSales={allSales} partnerById={partnerById} productByKey={productByKey} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------
function DashboardTab({ partners, allSales, productByKey, products }) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today));
  const [group, setGroup] = useState('access_pass');
  const [catFilter, setCatFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  const months = useMemo(() => {
    const set = new Set([monthKey(today)]);
    allSales.forEach((s) => set.add(monthKey(new Date(s.sold_at))));
    return Array.from(set).sort().reverse();
  }, [allSales]);

  const productGroup = (s) => productByKey[s.product]?.group ?? 'access_pass';

  const monthSalesAll = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const from = new Date(y, m - 1, 1).getTime();
    const to = new Date(y, m, 1).getTime();
    return allSales.filter((s) => {
      const t = new Date(s.sold_at).getTime();
      return t >= from && t < to;
    });
  }, [allSales, selectedMonth]);

  const monthSales = useMemo(() => monthSalesAll.filter((s) => productGroup(s) === group), [monthSalesAll, group, productByKey]);
  const allGroupSales = useMemo(() => allSales.filter((s) => productGroup(s) === group), [allSales, group, productByKey]);

  const monthTotals = sumSales(monthSales);
  const allTotals = sumSales(allGroupSales);

  const byProduct = products.filter((p) => p.group === group).map((p) => ({
    product: p,
    stats: sumSales(monthSales.filter((s) => s.product === p.key)),
  }));

  const byPartner = useMemo(() => {
    const map = {};
    monthSales.forEach((s) => {
      if (!map[s.partner_id]) map[s.partner_id] = { count: 0, paid: 0, commission: 0 };
      map[s.partner_id].count += 1;
      map[s.partner_id].paid += Number(s.amount_paid);
      map[s.partner_id].commission += Number(s.commission_amount);
    });
    return partners
      .map((p) => ({ partner: p, stats: map[p.id] || { count: 0, paid: 0, commission: 0 } }))
      .filter((r) => catFilter === 'all' || r.partner.category === catFilter)
      .sort((a, b) => b.stats.count - a.stats.count);
  }, [monthSales, partners, catFilter]);

  const handleDeleteSale = async (sale) => {
    if (!window.confirm(`Excluir o registro de cupom de "${sale.customer_name}"?`)) return;
    setDeletingId(sale.id);
    try {
      await api.delete(`/admin/coupon-partners/sales/${sale.id}`);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ key: 'access_pass', label: 'Access Pass' }, { key: 'espacos', label: 'Atrium & Gallery' }].map((g) => (
            <button
              key={g.key}
              className={`btn btn-sm ${group === g.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <select className="form-control" style={{ width: 'auto' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {months.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
        </select>
      </div>

      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Cupons utilizados (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{monthTotals.count}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Receita líquida (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{brl(monthTotals.paid)}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Comissões a pagar (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{brl(monthTotals.commission)}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Cupons no histórico</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{allTotals.count}</div>
        </div>
      </div>

      {byProduct.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
          {byProduct.map(({ product, stats }) => (
            <div key={product.key} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{product.label}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{brl(product.price)} · {Math.round(product.commissionRate * 100)}%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Cupons</div><div style={{ fontWeight: 700 }}>{stats.count}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Receita</div><div style={{ fontWeight: 700 }}>{brl(stats.paid)}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Comissão</div><div style={{ fontWeight: 700 }}>{brl(stats.commission)}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title" style={{ marginBottom: 10 }}>Utilização por influenciador</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[{ key: 'all', label: 'Todos' }, { key: 'fixo', label: 'Fixos' }, { key: 'avulso', label: 'Avulsos' }].map((c) => (
          <button key={c.key} className={`btn btn-sm ${catFilter === c.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCatFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="table-container" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Influenciador</th>
              <th>Cupom</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Cupons</th>
              <th style={{ textAlign: 'right' }}>Receita</th>
              <th style={{ textAlign: 'right' }}>Comissão</th>
            </tr>
          </thead>
          <tbody>
            {byPartner.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>Nenhum influenciador cadastrado.</td></tr>
            ) : byPartner.map(({ partner, stats }) => (
              <tr key={partner.id}>
                <td style={{ fontWeight: 600 }}>{partner.name}{!partner.effective_active && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-muted)' }}>(inativo)</span>}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{partner.coupon_code}</td>
                <td><span className="badge badge-success" style={{ textTransform: 'capitalize' }}>{CATEGORY_LABEL[partner.category]}</span></td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{stats.count}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(stats.paid)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(stats.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title" style={{ marginBottom: 10 }}>Cupons registrados no mês</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Influenciador</th>
              <th>Cliente</th>
              <th style={{ textAlign: 'right' }}>Valor pago</th>
              <th style={{ textAlign: 'right' }}>Comissão</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {monthSales.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>Nenhum cupom registrado neste mês.</td></tr>
            ) : monthSales.map((s) => {
              const partner = partners.find((p) => p.id === s.partner_id);
              return (
                <tr key={s.id}>
                  <td style={{ fontSize: 13, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{new Date(s.sold_at).toLocaleString('pt-BR')}</td>
                  <td><span className="badge badge-warning">{productByKey[s.product]?.shortLabel ?? s.product}</span></td>
                  <td>{partner?.name ?? '—'}</td>
                  <td>{s.customer_name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(s.amount_paid)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(s.commission_amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => handleDeleteSale(s)} disabled={deletingId === s.id}>
                      {deletingId === s.id ? '...' : 'Excluir'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partners tab
// ---------------------------------------------------------------------------
function PartnersTab({ partners, onChanged }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null); // partner | null

  const grouped = {
    fixo: partners.filter((p) => p.category === 'fixo'),
    avulso: partners.filter((p) => p.category === 'avulso'),
  };

  const handleToggleActive = async (partner) => {
    try {
      await api.patch(`/admin/coupon-partners/${partner.id}`, { active: !partner.active });
      onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar.');
    }
  };

  const handleDelete = async (partner) => {
    if (!window.confirm(`Excluir "${partner.name}" (${partner.coupon_code})?`)) return;
    try {
      await api.delete(`/admin/coupon-partners/${partner.id}`);
      onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Novo parceiro</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {['fixo', 'avulso'].map((cat) => (
          <div key={cat} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700 }}>{cat === 'fixo' ? 'Parceiros Fixos' : 'Parceiros Avulsos'}</span>
              <span className="badge badge-success">{grouped[cat].length}</span>
            </div>
            <div>
              {grouped[cat].length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>Nenhum parceiro nesta categoria.</div>
              ) : grouped[cat].map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{p.coupon_code}</div>
                    {p.category === 'avulso' && p.expires_at && (
                      <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                        {new Date(p.expires_at).getTime() <= Date.now() ? 'Expirado em ' : 'Expira em '}
                        {new Date(p.expires_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.effective_active ? (
                      <span className="badge badge-success">Ativo</span>
                    ) : (
                      <span className="badge badge-warning">Inativo</span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(p)}>
                      {p.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(p)}>Editar</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(p)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(showCreate || editing) && (
        <PartnerFormModal
          partner={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function PartnerFormModal({ partner, onClose, onSaved }) {
  const isEdit = !!partner;
  const [name, setName] = useState(partner?.name || '');
  const [couponCode, setCouponCode] = useState(partner?.coupon_code || '');
  const [category, setCategory] = useState(partner?.category || 'avulso');
  const [expiresAt, setExpiresAt] = useState(partner?.expires_at ? partner.expires_at.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { name, coupon_code: couponCode, category, expires_at: category === 'avulso' ? (expiresAt || null) : null };
      if (isEdit) {
        await api.patch(`/admin/coupon-partners/${partner.id}`, payload);
      } else {
        await api.post('/admin/coupon-partners', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar parceiro' : 'Novo parceiro'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Nome</label>
          <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Código do cupom</label>
          <input
            type="text"
            className="form-control"
            style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Categoria</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['fixo', 'avulso'].map((c) => (
              <button
                key={c}
                type="button"
                className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, textTransform: 'capitalize' }}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {category === 'avulso' && (
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Validade do cupom (opcional)</label>
            <input type="date" className="form-control" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>O cupom fica inativo automaticamente após essa data.</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim() || !couponCode.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register tab
// ---------------------------------------------------------------------------
function RegisterTab({ partners, products, onSaved }) {
  const activePartners = partners.filter((p) => p.effective_active);
  const [product, setProduct] = useState('access_pass');
  const [partnerId, setPartnerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [soldAt, setSoldAt] = useState(toDateInputValue());
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cfg = products.find((p) => p.key === product);
  const totals = cfg
    ? { price: cfg.price, discount: +(cfg.price * cfg.discountRate).toFixed(2), amountPaid: +(cfg.price * (1 - cfg.discountRate)).toFixed(2), commission: +(cfg.price * cfg.commissionRate).toFixed(2) }
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!partnerId) { setError('Selecione o influenciador.'); return; }
    if (!customerName.trim()) { setError('Informe o nome do cliente.'); return; }

    setSaving(true);
    try {
      const res = await api.post('/admin/coupon-partners/sales', {
        partner_id: partnerId,
        customer_name: customerName.trim(),
        product,
        sold_at: soldAt,
        payment_confirmed: paymentConfirmed,
      });
      const emailInfo = res.data?.email;
      if (emailInfo && !emailInfo.sent) {
        alert(`Cupom registrado, mas o e-mail de notificação não foi enviado.\n\nMotivo: ${emailInfo.reason || emailInfo.error || 'desconhecido'}`);
      }
      setCustomerName('');
      setSoldAt(toDateInputValue());
      setPaymentConfirmed(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar o cupom.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520, padding: 24 }}>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Produto</label>
          <select className="form-control" value={product} onChange={(e) => setProduct(e.target.value)} disabled={saving}>
            {products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Influenciador / parceiro</label>
          <select className="form-control" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} disabled={saving}>
            <option value="">Selecione...</option>
            {activePartners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.coupon_code})</option>)}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Nome do cliente</label>
          <input type="text" className="form-control" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={saving} />
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Data da venda</label>
          <input type="date" className="form-control" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} disabled={saving} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} disabled={saving} />
          Pagamento já confirmado
        </label>

        {totals && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14, background: 'var(--surface-muted)', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
            <div><span style={{ color: 'var(--ink-muted)' }}>Valor cheio: </span><strong>{brl(totals.price)}</strong></div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Desconto: </span><strong>{brl(totals.discount)}</strong></div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Valor pago: </span><strong>{brl(totals.amountPaid)}</strong></div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Comissão: </span><strong>{brl(totals.commission)}</strong></div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
          {saving ? 'Registrando...' : 'Registrar cupom'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports tab
// ---------------------------------------------------------------------------
function ReportsTab({ partners, allSales }) {
  const today = new Date();
  const [month, setMonth] = useState(monthKey(today));

  const months = useMemo(() => {
    const set = new Set([monthKey(today)]);
    allSales.forEach((s) => set.add(monthKey(new Date(s.sold_at))));
    return Array.from(set).sort().reverse();
  }, [allSales]);

  const monthSales = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(y, m - 1, 1).getTime();
    const to = new Date(y, m, 1).getTime();
    return allSales.filter((s) => {
      const t = new Date(s.sold_at).getTime();
      return t >= from && t < to;
    });
  }, [allSales, month]);

  const summary = useMemo(() => {
    const map = {};
    monthSales.forEach((s) => {
      if (!map[s.partner_id]) map[s.partner_id] = { count: 0, paid: 0, commission: 0 };
      map[s.partner_id].count += 1;
      map[s.partner_id].paid += Number(s.amount_paid);
      map[s.partner_id].commission += Number(s.commission_amount);
    });
    return partners
      .map((p) => ({ partner: p, ...(map[p.id] || { count: 0, paid: 0, commission: 0 }) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.commission - a.commission);
  }, [monthSales, partners]);

  const totals = summary.reduce((acc, r) => ({ count: acc.count + r.count, paid: acc.paid + r.paid, commission: acc.commission + r.commission }), { count: 0, paid: 0, commission: 0 });

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const res = await api.get('/admin/coupon-partners/report.csv', { params: { year: y, month: m }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cupons-access-pass-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao gerar o relatório.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          <IconDownload size={14} /> {downloading ? 'Gerando...' : 'Baixar CSV'}
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Influenciador</th>
              <th>Cupom</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Qtd Cupons</th>
              <th style={{ textAlign: 'right' }}>Receita</th>
              <th style={{ textAlign: 'right' }}>Comissão</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>Nenhum cupom registrado neste mês.</td></tr>
            ) : summary.map((r) => (
              <tr key={r.partner.id}>
                <td style={{ fontWeight: 600 }}>{r.partner.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.partner.coupon_code}</td>
                <td style={{ textTransform: 'capitalize' }}>{CATEGORY_LABEL[r.partner.category]}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{r.count}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.paid)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.commission)}</td>
              </tr>
            ))}
          </tbody>
          {summary.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total</td>
                <td style={{ textAlign: 'right' }}>{totals.count}</td>
                <td style={{ textAlign: 'right' }}>{brl(totals.paid)}</td>
                <td style={{ textAlign: 'right' }}>{brl(totals.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
