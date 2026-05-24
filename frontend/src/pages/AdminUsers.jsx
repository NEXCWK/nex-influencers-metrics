import React, { useState, useEffect } from 'react';
import api from '../api.js';

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RoleBadge({ role }) {
  if (role === 'admin') return <span className="badge badge-warning">Admin</span>;
  return <span className="badge badge-success">Influenciador</span>;
}

function StatusBadge({ active }) {
  if (active) return <span className="badge badge-success">Ativo</span>;
  return <span className="badge badge-danger">Inativo</span>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

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

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Resetar a senha de "${user.display_name || user.username}"?\n\nEle precisará definir uma nova senha no próximo login.`)) return;
    setUserLoading(user.id, 'reset');
    try {
      const res = await api.post(`/admin/users/${user.id}/reset-password`);
      const tempPassword = res.data?.temp_password;
      if (tempPassword) {
        alert(`Senha resetada com sucesso!\n\nSenha temporária: ${tempPassword}\n\nAnote e repasse ao usuário.`);
      } else {
        alert('Senha resetada com sucesso! O usuário deverá definir uma nova senha no próximo acesso.');
      }
      // Refresh to update must_change_password flag
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao resetar senha.');
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
      alert(err.response?.data?.detail || 'Erro ao alterar status do usuário.');
    } finally {
      setUserLoading(user.id, null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usuários</h1>
        <button className="btn btn-secondary" onClick={fetchUsers}>
          ↺ Atualizar
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <strong>Nota:</strong> Para adicionar novos usuários, é necessário rodar o seed no banco de dados. Contate o administrador do sistema.
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 8 }} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: 32 }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, fontFamily: 'Arial', flexShrink: 0,
                      }}>
                        {(user.display_name || user.username || 'U')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, fontFamily: 'Arial' }}>
                        {user.display_name || user.username}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Arial' }}>
                    @{user.username}
                  </td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge active={user.is_active} />
                      {user.must_change_password && (
                        <span className="badge badge-warning" style={{ fontSize: 11 }}>Senha temp.</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDate(user.last_login)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleResetPassword(user)}
                        disabled={!!actionLoading[user.id]}
                      >
                        {actionLoading[user.id] === 'reset' ? '...' : '🔑 Resetar Senha'}
                      </button>
                      <button
                        className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-primary'}`}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
