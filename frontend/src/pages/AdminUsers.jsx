import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader, Segmented, EmptyState, Skeleton, Modal, Avatar, Spinner, Menu, MenuItem } from '../components/ui.jsx';
import { IconPlus, IconSearch, IconUsers, IconRefresh, IconKey, IconLock, IconUnlock } from '../components/Icons.jsx';
import { relativeTime, formatDateTime } from '../utils/format.js';

const DEFAULT_PASSWORD = 'nex2026';

const ROLE_META = {
  admin: { label: 'Admin', className: 'badge-dark' },
  operacao: { label: 'Operação', className: 'badge-warning' },
  influencer: { label: 'Influenciador', className: 'badge-neutral' },
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.influencer;
  return <span className={`badge ${meta.className}`}>{meta.label}</span>;
}

function StatusBadge({ active }) {
  return active
    ? <span className="badge badge-success"><span className="dot" />Ativo</span>
    : <span className="badge badge-neutral"><span className="dot" style={{ opacity: 0.4 }} />Inativo</span>;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', display_name: '', role: 'influencer' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data?.users || res.data || []);
    } catch {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const setUserLoading = (id, value) => {
    setActionLoading((prev) => ({ ...prev, [id]: value }));
  };

  const openCreate = () => {
    setForm({ username: '', display_name: '', role: 'influencer' });
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!form.username.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await api.post('/admin/users', {
        username: form.username.trim().toLowerCase(),
        display_name: form.display_name.trim(),
        role: form.role,
      });
      const pwd = res.data?.default_password || DEFAULT_PASSWORD;
      const u = res.data?.user;
      const emailInfo = res.data?.email;
      setShowCreate(false);

      let emailNote = '';
      if (emailInfo) {
        emailNote = emailInfo.sent
          ? '\n\nConvite enviado por e-mail com sucesso!'
          : `\n\nO convite por e-mail NÃO foi enviado (${emailInfo.reason || emailInfo.error || 'motivo desconhecido'}). Repasse o login/senha manualmente.`;
      }

      alert(
        `Usuário criado com sucesso!\n\n` +
        `Login: ${u?.username}\n` +
        `Senha padrão: ${pwd}\n\n` +
        `No primeiro acesso será obrigatório definir uma nova senha.` +
        emailNote
      );
      fetchUsers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Erro ao criar o usuário.');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Resetar a senha de "${user.display_name || user.username}"?\n\nA senha volta para a padrão e uma nova senha será exigida no próximo login.`)) return;
    setUserLoading(user.id, 'reset');
    try {
      await api.post(`/admin/users/${user.id}/reset-password`);
      // The backend resets to the default password (it never returns a
      // temporary one), so tell the admin what to pass along.
      alert(`Senha resetada com sucesso!\n\nNova senha (padrão): ${DEFAULT_PASSWORD}\n\nRepasse ao usuário — ele precisará trocá-la no próximo login.`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Erro ao resetar senha.');
    } finally {
      setUserLoading(user.id, null);
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'desativar' : 'ativar';
    if (!window.confirm(`Deseja ${action} o usuário "${user.display_name || user.username}"?`)) return;
    setUserLoading(user.id, 'toggle');
    try {
      const res = await api.patch(`/admin/users/${user.id}/toggle`);
      const updated = res.data;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: updated.is_active ?? !user.is_active } : u));
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail;
      alert(msg === 'You cannot deactivate your own account'
        ? 'Você não pode desativar a sua própria conta.'
        : msg || 'Erro ao alterar status.');
    } finally {
      setUserLoading(user.id, null);
    }
  };

  const counts = users.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] || 0) + 1 }), {});

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.display_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle={`Quem acessa a plataforma. Novos usuários entram com a senha padrão ${DEFAULT_PASSWORD} e definem a própria senha no primeiro acesso.`}
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
              <IconRefresh size={14} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus size={15} /> Adicionar usuário
            </button>
          </>
        )}
      />

      <div className="toolbar">
        <Segmented
          ariaLabel="Filtrar por perfil"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: '', label: 'Todos', count: users.length },
            { value: 'influencer', label: 'Influenciadores', count: counts.influencer || 0 },
            { value: 'admin', label: 'Admins', count: counts.admin || 0 },
            { value: 'operacao', label: 'Operação', count: counts.operacao || 0 },
          ]}
        />
        <div className="toolbar-spacer" />
        <div className="input-icon" style={{ flex: '0 1 300px' }}>
          <IconSearch size={15} />
          <input
            type="search"
            className="form-control"
            placeholder="Buscar usuário"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar usuários"
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Skeleton height={320} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Status</th>
                <th className="hide-sm">Último acesso</th>
                <th className="num"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState icon={<IconUsers size={20} />} title="Nenhum usuário encontrado" text="Ajuste a busca ou o filtro de perfil." />
                  </td>
                </tr>
              ) : filtered.map((user) => {
                const name = user.display_name || user.username;
                const busy = actionLoading[user.id];
                const isMe = me?.id === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar name={name} size={32} variant={user.role === 'admin' ? 'accent' : 'muted'} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title">{name}{isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}</div>
                          <div className="cell-sub">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={user.role} /></td>
                    <td>
                      <div className="row">
                        <StatusBadge active={user.is_active} />
                        {user.must_change_password && (
                          <span className="badge badge-warning" title="Ainda usa a senha padrão — troca obrigatória no próximo login">Senha temporária</span>
                        )}
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span className="muted tabular" title={formatDateTime(user.last_login)} style={{ fontSize: 13 }}>
                        {user.last_login ? relativeTime(user.last_login) : 'Nunca acessou'}
                      </span>
                    </td>
                    <td>
                      <div className="cell-actions">
                        {busy ? (
                          <Spinner size={16} />
                        ) : (
                          <Menu buttonClassName="btn btn-icon" label={`Ações para ${name}`}>
                            <MenuItem icon={<IconKey size={15} />} hint={`Volta para ${DEFAULT_PASSWORD}`} onClick={() => handleResetPassword(user)}>
                              Resetar senha
                            </MenuItem>
                            <hr className="menu-divider" />
                            <MenuItem
                              icon={user.is_active ? <IconLock size={15} /> : <IconUnlock size={15} />}
                              danger={user.is_active}
                              disabled={isMe && user.is_active}
                              hint={isMe && user.is_active ? 'Você não pode desativar a sua conta' : undefined}
                              onClick={() => handleToggleStatus(user)}
                            >
                              {user.is_active ? 'Desativar acesso' : 'Reativar acesso'}
                            </MenuItem>
                          </Menu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal
          title="Adicionar usuário"
          subtitle={`A senha inicial será ${DEFAULT_PASSWORD}, com troca obrigatória no primeiro login.`}
          onClose={() => setShowCreate(false)}
          maxWidth={480}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</button>
              <button type="submit" form="create-user-form" className="btn btn-primary" disabled={creating || !form.username.trim()}>
                {creating ? <><Spinner /> Criando...</> : 'Criar usuário'}
              </button>
            </>
          )}
        >
          <form id="create-user-form" onSubmit={handleCreate} noValidate>
            {createError && <div className="alert alert-error">{createError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="new-username">Nome de usuário (login)</label>
              <input
                id="new-username"
                type="text"
                className="form-control"
                placeholder="ex: jaque ou nome@nexcoworking.com.br"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
              <p className="form-hint">
                Minúsculas, números, ponto, hífen, underline ou @ — sem espaços. Se usar um
                e-mail, o sistema tenta enviar um convite automaticamente para ele.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-display">Nome de exibição <span className="muted">(opcional)</span></label>
              <input
                id="new-display"
                type="text"
                className="form-control"
                placeholder="ex: Jaque"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-role">Perfil</label>
              <select
                id="new-role"
                className="form-control"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="influencer">Influenciador</option>
                <option value="admin">Admin</option>
                <option value="operacao">Operação (só vê Registro de Cupons)</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
