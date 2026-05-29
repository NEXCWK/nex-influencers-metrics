import React, { useState, useEffect } from 'react';
import api from '../api.js';

function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `ha ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `ha ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `ha ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `ha ${months}m`;
  return `ha ${Math.floor(months / 12)}a`;
}

function formatDateFull(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="badge badge-warning">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Admin
      </span>
    );
  }
  return (
    <span className="badge badge-success">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Influenciador
    </span>
  );
}

function StatusBadge({ active }) {
  if (active) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--success)', fontWeight: 500, fontFamily: 'var(--font)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, display: 'inline-block' }} />
        Ativo
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--ink-muted)', fontWeight: 500, fontFamily: 'var(--font)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
      Inativo
    </span>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data?.users || res.data || []);
    } catch {
      setError('Erro ao carregar usuarios.');
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

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Resetar a senha de "${user.display_name || user.username}"?\n\nEle precisara definir uma nova senha no proximo login.`)) return;
    setUserLoading(user.id, 'reset');
    try {
      const res = await api.post(`/admin/users/${user.id}/reset-password`);
      const tempPassword = res.data?.temp_password;
      if (tempPassword) {
        alert(`Senha resetada com sucesso!\n\nSenha temporaria: ${tempPassword}\n\nAnote e repasse ao usuario.`);
      } else {
        alert('Senha resetada com sucesso!');
      }
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao resetar senha.');
    } finally {
      setUserLoading(user.id, null);
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'desativar' : 'ativar';
    if (!window.confirm(`Deseja ${action} o usuario "${user.display_name || user.username}"?`)) return;
    setUserLoading(user.id, 'toggle');
    try {
      const res = await api.patch(`/admin/users/${user.id}/toggle`);
      const updated = res.data;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: updated.is_active ?? !user.is_active } : u));
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao alterar status.');
    } finally {
      setUserLoading(user.id, null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.display_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usuarios</h1>
        <button className="btn btn-secondary" onClick={fetchUsers}>
          Atualizar
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px 12px 16px',
        background: 'var(--accent-soft)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 20,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a5800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#7a5800', fontFamily: 'var(--font)', marginBottom: 2 }}>
            Adicionar usuarios
          </p>
          <p style={{ fontSize: 13, color: '#7a5800', fontFamily: 'var(--font)', fontWeight: 400 }}>
            Para adicionar novos usuarios e necessario rodar o seed no banco de dados.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar por nome ou usuario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <select
          className="form-control"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Todos os perfis</option>
          <option value="admin">Admin</option>
          <option value="influencer">Influenciador</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuario</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Ultimo acesso</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              ) : filtered.map((user) => {
                const isAdmin = user.role === 'admin';
                const avatarBg = isAdmin ? 'var(--accent)' : '#E0DED8';
                const avatarColor = isAdmin ? 'var(--ink)' : 'var(--ink-muted)';
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: avatarBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, fontFamily: 'var(--font)', flexShrink: 0, color: avatarColor,
                        }}>
                          {(user.display_name || user.username || 'U')[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)' }}>
                          {user.display_name || user.username}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                      @{user.username}
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <StatusBadge active={user.is_active} />
                        {user.must_change_password && (
                          <span className="badge badge-warning" style={{ fontSize: 11 }}>Senha temp.</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        title={formatDateFull(user.last_login)}
                        style={{ fontSize: 13, color: 'var(--ink-muted)', cursor: 'default', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {relativeTime(user.last_login)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleResetPassword(user)}
                          disabled={!!actionLoading[user.id]}
                        >
                          {actionLoading[user.id] === 'reset' ? '...' : 'Resetar Senha'}
                        </button>
                        <button
                          className={`btn btn-sm ${user.is_active ? 'btn-danger-outline' : 'btn-primary'}`}
                          onClick={() => handleToggleStatus(user)}
                          disabled={!!actionLoading[user.id]}
                        >
                          {actionLoading[user.id] === 'toggle'
                            ? '...'
                            : user.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
