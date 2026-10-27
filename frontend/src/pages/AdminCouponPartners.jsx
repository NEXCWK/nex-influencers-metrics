import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api.js';
import MetricCard from '../components/MetricCard.jsx';
import {
  IconDownload, IconPlus, IconRefresh, IconTicket, IconDollar, IconKey, IconTrash, IconPencil,
  IconLock, IconUnlock, IconCheck, IconUsers, IconBarChart, IconList,
} from '../components/Icons.jsx';
import {
  PageHeader, Tabs, Segmented, EmptyState, Skeleton, Modal, Spinner, Menu, MenuItem, SectionHeader,
} from '../components/ui.jsx';

const CATEGORY_LABEL = { fixo: 'Fixo', avulso: 'Avulso' };

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
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

// Months available in the selectors: the current one + every month with sales.
function useSaleMonths(allSales) {
  return useMemo(() => {
    const set = new Set([monthKey(new Date())]);
    allSales.forEach((s) => set.add(monthKey(new Date(s.sold_at))));
    return Array.from(set).sort().reverse();
  }, [allSales]);
}

function salesInMonth(allSales, mk) {
  const [y, m] = mk.split('-').map(Number);
  const from = new Date(y, m - 1, 1).getTime();
  const to = new Date(y, m, 1).getTime();
  return allSales.filter((s) => {
    const t = new Date(s.sold_at).getTime();
    return t >= from && t < to;
  });
}

function MonthKeySelect({ months, value, onChange }) {
  return (
    <select className="form-control" style={{ width: 'auto' }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Mês">
      {months.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
    </select>
  );
}

export default function AdminCouponPartners() {
  const [tab, setTab] = useState('dashboard');

  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [migrationPending, setMigrationPending] = useState(false);

  // `silent` refreshes keep the current tab mounted (selected month, filters,
  // success messages) instead of swapping everything for a skeleton.
  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refresh = useCallback(() => fetchAll({ silent: true }), [fetchAll]);

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

  const activeCount = partners.filter((p) => p.effective_active).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Cupons' }]}
        title="Registro de cupons"
        subtitle="Vendas de Access Pass, Atrium e Gallery feitas com os cupons dos influenciadores parceiros, com receita e comissões."
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading || refreshing}>
              {refreshing ? <Spinner /> : <IconRefresh size={14} />} Atualizar
            </button>
            {tab !== 'register' && (
              <button type="button" className="btn btn-primary" onClick={() => setTab('register')}>
                <IconPlus size={15} /> Registrar cupom
              </button>
            )}
          </>
        )}
      />

      {migrationPending && (
        <div className="alert alert-error">
          As tabelas de cupons ainda não existem no banco. Rode a migration 008_coupon_partners.sql no Supabase.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <Tabs
        ariaLabel="Seções do registro de cupons"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'dashboard', label: 'Painel', icon: <IconBarChart size={15} /> },
          { value: 'register', label: 'Registrar cupom', icon: <IconPlus size={15} /> },
          { value: 'partners', label: 'Parceiros', icon: <IconUsers size={15} />, count: loading ? undefined : activeCount },
          { value: 'reports', label: 'Relatórios', icon: <IconList size={15} /> },
        ]}
      />

      {loading ? (
        <Skeleton height={320} />
      ) : (
        <>
          {tab === 'dashboard' && <DashboardTab partners={partners} allSales={allSales} productByKey={productByKey} products={products} onChanged={refresh} />}
          {tab === 'partners' && <PartnersTab partners={partners} onChanged={refresh} />}
          {tab === 'register' && <RegisterTab partners={partners} products={products} onSaved={refresh} />}
          {tab === 'reports' && <ReportsTab partners={partners} allSales={allSales} partnerById={partnerById} productByKey={productByKey} />}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------
function DashboardTab({ partners, allSales, productByKey, products, onChanged }) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [group, setGroup] = useState('access_pass');
  const [catFilter, setCatFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  const months = useSaleMonths(allSales);

  const productGroup = (s) => productByKey[s.product]?.group ?? 'access_pass';

  const monthSalesAll = useMemo(() => salesInMonth(allSales, selectedMonth), [allSales, selectedMonth]);

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
      // Refresh the data in place (a full page reload used to reset the tab
      // and the selected month).
      await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <Segmented
          ariaLabel="Produto"
          value={group}
          onChange={setGroup}
          options={[{ value: 'access_pass', label: 'Access Pass' }, { value: 'espacos', label: 'Atrium & Gallery' }]}
        />
        <div className="toolbar-spacer" />
        <MonthKeySelect months={months} value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div className="metrics-grid">
        <MetricCard label="Cupons utilizados" value={monthTotals.count} unit="raw" icon={<IconTicket size={16} />} hint="no mês" highlight />
        <MetricCard label="Receita líquida" value={brl(monthTotals.paid)} icon={<IconDollar size={16} />} hint="no mês" />
        <MetricCard label="Comissões a pagar" value={brl(monthTotals.commission)} icon={<IconKey size={16} />} hint="no mês" />
        <MetricCard label="Cupons no histórico" value={allTotals.count} unit="raw" icon={<IconList size={16} />} hint="todos os meses" />
      </div>

      {byProduct.length > 1 && (
        <div className="grid-auto" style={{ marginTop: 16 }}>
          {byProduct.map(({ product, stats }) => (
            <div key={product.key} className="card" style={{ padding: 18 }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span className="card-title">{product.label}</span>
                <span className="muted" style={{ fontSize: 12 }}>{brl(product.price)} · comissão {Math.round(product.commissionRate * 100)}%</span>
              </div>
              <div className="kv-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="kv"><span className="kv-label">Cupons</span><span className="kv-value">{stats.count}</span></div>
                <div className="kv"><span className="kv-label">Receita</span><span className="kv-value" style={{ fontSize: 14 }}>{brl(stats.paid)}</span></div>
                <div className="kv"><span className="kv-label">Comissão</span><span className="kv-value" style={{ fontSize: 14 }}>{brl(stats.commission)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="section">
        <SectionHeader
          title="Utilização por influenciador"
          actions={(
            <Segmented
              ariaLabel="Categoria"
              value={catFilter}
              onChange={setCatFilter}
              options={[{ value: 'all', label: 'Todos' }, { value: 'fixo', label: 'Fixos' }, { value: 'avulso', label: 'Avulsos' }]}
            />
          )}
        />
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Influenciador</th>
                <th>Cupom</th>
                <th className="hide-sm">Categoria</th>
                <th className="num">Cupons</th>
                <th className="num">Receita</th>
                <th className="num">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {byPartner.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 0 }}><EmptyState icon={<IconUsers size={20} />} title="Nenhum influenciador cadastrado" /></td></tr>
              ) : byPartner.map(({ partner, stats }) => (
                <tr key={partner.id}>
                  <td>
                    <span className="cell-title">{partner.name}</span>
                    {!partner.effective_active && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Inativo</span>}
                  </td>
                  <td className="mono">{partner.coupon_code}</td>
                  <td className="hide-sm"><span className="badge badge-neutral">{CATEGORY_LABEL[partner.category]}</span></td>
                  <td className="num strong">{stats.count}</td>
                  <td className="num">{brl(stats.paid)}</td>
                  <td className="num">{brl(stats.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <SectionHeader title="Cupons registrados no mês" hint={`${monthSales.length} ${monthSales.length === 1 ? 'registro' : 'registros'} em ${monthLabel(selectedMonth).toLowerCase()}`} />
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Influenciador</th>
                <th>Cliente</th>
                <th className="num">Valor pago</th>
                <th className="num">Comissão</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {monthSales.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 0 }}><EmptyState icon={<IconTicket size={20} />} title="Nenhum cupom registrado neste mês" /></td></tr>
              ) : monthSales.map((s) => {
                const partner = partners.find((p) => p.id === s.partner_id);
                return (
                  <tr key={s.id}>
                    <td className="muted nowrap" style={{ fontSize: 13 }}>{new Date(s.sold_at).toLocaleDateString('pt-BR')}</td>
                    <td><span className="badge badge-accent">{productByKey[s.product]?.shortLabel ?? s.product}</span></td>
                    <td className="cell-title">{partner?.name ?? '—'}</td>
                    <td>{s.customer_name}</td>
                    <td className="num">{brl(s.amount_paid)}</td>
                    <td className="num">{brl(s.commission_amount)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-icon danger"
                        onClick={() => handleDeleteSale(s)}
                        disabled={deletingId === s.id}
                        title="Excluir registro"
                        aria-label="Excluir registro"
                      >
                        {deletingId === s.id ? <Spinner size={14} /> : <IconTrash size={15} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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
      <div className="toolbar">
        <p className="muted" style={{ fontSize: 13 }}>
          Parceiros fixos têm cupom permanente; avulsos podem ter validade.
        </p>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-dark" onClick={() => setShowCreate(true)}>
          <IconPlus size={15} /> Novo parceiro
        </button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {['fixo', 'avulso'].map((cat) => (
          <div key={cat} className="card card-flush">
            <div className="card-header">
              <span className="card-title">{cat === 'fixo' ? 'Parceiros fixos' : 'Parceiros avulsos'}</span>
              <span className="badge badge-neutral">{grouped[cat].length}</span>
            </div>
            <div>
              {grouped[cat].length === 0 ? (
                <EmptyState title="Nenhum parceiro nesta categoria" />
              ) : grouped[cat].map((p, i) => {
                const expired = p.expires_at && new Date(p.expires_at).getTime() <= Date.now();
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      padding: '12px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="cell-title">{p.name}</div>
                      <div className="row" style={{ gap: 10, marginTop: 2 }}>
                        <span className="mono muted">{p.coupon_code}</span>
                        {p.category === 'avulso' && p.expires_at && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {expired ? 'Expirado em ' : 'Expira em '}
                            {new Date(p.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      {p.effective_active
                        ? <span className="badge badge-success"><span className="dot" />Ativo</span>
                        : <span className="badge badge-neutral">Inativo</span>}
                      <Menu buttonClassName="btn btn-icon" label={`Ações para ${p.name}`}>
                        <MenuItem icon={<IconPencil size={15} />} onClick={() => setEditing(p)}>Editar</MenuItem>
                        <MenuItem
                          icon={p.active ? <IconLock size={15} /> : <IconUnlock size={15} />}
                          onClick={() => handleToggleActive(p)}
                        >
                          {p.active ? 'Desativar' : 'Ativar'}
                        </MenuItem>
                        <hr className="menu-divider" />
                        <MenuItem icon={<IconTrash size={15} />} danger onClick={() => handleDelete(p)}>Excluir</MenuItem>
                      </Menu>
                    </div>
                  </div>
                );
              })}
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

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!name.trim() || !couponCode.trim()) return;
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
    <Modal
      title={isEdit ? 'Editar parceiro' : 'Novo parceiro'}
      onClose={onClose}
      maxWidth={460}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="partner-form" className="btn btn-primary" disabled={saving || !name.trim() || !couponCode.trim()}>
            {saving ? <><Spinner /> Salvando...</> : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id="partner-form" onSubmit={handleSave} noValidate>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="partner-name">Nome</label>
          <input id="partner-name" type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="partner-code">Código do cupom</label>
          <input
            id="partner-code"
            type="text"
            className="form-control"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textTransform: 'uppercase' }}
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
          />
        </div>
        <div className="form-group">
          <span className="form-label">Categoria</span>
          <Segmented
            ariaLabel="Categoria"
            value={category}
            onChange={setCategory}
            options={[{ value: 'fixo', label: 'Fixo' }, { value: 'avulso', label: 'Avulso' }]}
          />
        </div>
        {category === 'avulso' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="partner-expires">Validade do cupom <span className="muted">(opcional)</span></label>
            <input id="partner-expires" type="date" className="form-control" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <p className="form-hint">O cupom fica inativo automaticamente após essa data.</p>
          </div>
        )}
      </form>
    </Modal>
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
  const [success, setSuccess] = useState('');

  const cfg = products.find((p) => p.key === product);
  const totals = cfg
    ? { price: cfg.price, discount: +(cfg.price * cfg.discountRate).toFixed(2), amountPaid: +(cfg.price * (1 - cfg.discountRate)).toFixed(2), commission: +(cfg.price * cfg.commissionRate).toFixed(2) }
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      const partner = partners.find((p) => p.id === partnerId);
      setSuccess(`Cupom de ${customerName.trim()} registrado${partner ? ` para ${partner.name}` : ''}.`);
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
    <div className="split-layout">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2 className="card-title" style={{ marginBottom: 18 }}>Nova venda com cupom</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="alert alert-success" role="status">
            <IconCheck size={16} /><span>{success}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="sale-product">Produto</label>
          <select id="sale-product" className="form-control" value={product} onChange={(e) => setProduct(e.target.value)} disabled={saving}>
            {products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sale-partner">Influenciador / parceiro</label>
          <select id="sale-partner" className="form-control" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} disabled={saving}>
            <option value="">Selecione…</option>
            {activePartners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.coupon_code})</option>)}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="sale-customer">Nome do cliente</label>
            <input id="sale-customer" type="text" className="form-control" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={saving} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sale-date">Data da venda</label>
            <input id="sale-date" type="date" className="form-control" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} disabled={saving} />
          </div>
        </div>

        <label className="checkbox" style={{ marginBottom: 20 }}>
          <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} disabled={saving} />
          Pagamento já confirmado
        </label>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={saving}>
          {saving ? <><Spinner /> Registrando...</> : 'Registrar cupom'}
        </button>
      </form>

      {totals && (
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 12 }}>Resumo da venda</p>
          <p className="card-title" style={{ marginBottom: 16 }}>{cfg.label}</p>
          <dl style={{ display: 'grid', gap: 10 }}>
            {[
              ['Valor cheio', brl(totals.price)],
              ['Desconto do cupom', `− ${brl(totals.discount)}`],
              ['Valor pago pelo cliente', brl(totals.amountPaid), true],
              ['Comissão do parceiro', brl(totals.commission)],
            ].map(([label, value, strong]) => (
              <div key={label} className="row-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <dt className="muted" style={{ fontSize: 13 }}>{label}</dt>
                <dd style={{ fontFamily: 'var(--font-display)', fontWeight: strong ? 800 : 600, fontSize: strong ? 18 : 14 }} className="tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports tab
// ---------------------------------------------------------------------------
function ReportsTab({ partners, allSales }) {
  const [month, setMonth] = useState(monthKey(new Date()));

  const months = useSaleMonths(allSales);

  const monthSales = useMemo(() => salesInMonth(allSales, month), [allSales, month]);

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
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert('Erro ao gerar o relatório.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <MonthKeySelect months={months} value={month} onChange={setMonth} />
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-dark" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Spinner /> : <IconDownload size={15} />} {downloading ? 'Gerando...' : 'Baixar CSV'}
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Influenciador</th>
              <th>Cupom</th>
              <th className="hide-sm">Categoria</th>
              <th className="num">Qtd. cupons</th>
              <th className="num">Receita</th>
              <th className="num">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 0 }}><EmptyState icon={<IconTicket size={20} />} title="Nenhum cupom registrado neste mês" /></td></tr>
            ) : summary.map((r) => (
              <tr key={r.partner.id}>
                <td className="cell-title">{r.partner.name}</td>
                <td className="mono">{r.partner.coupon_code}</td>
                <td className="hide-sm">{CATEGORY_LABEL[r.partner.category]}</td>
                <td className="num strong">{r.count}</td>
                <td className="num">{brl(r.paid)}</td>
                <td className="num">{brl(r.commission)}</td>
              </tr>
            ))}
          </tbody>
          {summary.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="hide-sm" />
                <td className="num">{totals.count}</td>
                <td className="num">{brl(totals.paid)}</td>
                <td className="num">{brl(totals.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
