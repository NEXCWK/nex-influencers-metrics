import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import AuthLayout, { authStyles as styles } from '../components/AuthLayout.jsx';
import { IconLock, IconInfo } from '../components/Icons.jsx';

// The API answers in English; show the user a Portuguese message.
const ERROR_MESSAGES = {
  'New password must be different from the default password': 'A nova senha precisa ser diferente da senha padrão.',
  'Password must be at least 8 characters long': 'A senha deve ter pelo menos 8 caracteres.',
  'new_password is required': 'Informe a nova senha.',
};

export default function ChangePassword() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { new_password: newPassword });
      updateUser({ must_change_password: false });

      if (user?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user?.role === 'operacao') {
        navigate('/admin/coupon-partners', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const raw = err.response?.data?.error || err.response?.data?.message;
      setError(ERROR_MESSAGES[raw] || raw || 'Erro ao alterar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const firstName = (user?.display_name || user?.username || '').split(' ')[0];

  return (
    <AuthLayout>
      <img src="/images/logo-nex-preto.png" alt="Nex" className={styles.mobileLogo} />
      <h1 className={styles.title}>{firstName ? `Boas-vindas, ${firstName}!` : 'Defina sua senha'}</h1>
      <p className={styles.subtitle}>
        É o seu primeiro acesso. Por segurança, crie uma senha pessoal para continuar.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert">
            <IconInfo size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="newPassword">Nova senha</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}><IconLock size={16} /></span>
            <input
              id="newPassword"
              type="password"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              autoFocus
              disabled={loading}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="confirmPassword">Confirmar nova senha</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}><IconLock size={16} /></span>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? (
            <>
              <span className={styles.btnSpinner} />
              Salvando...
            </>
          ) : 'Definir senha e entrar'}
        </button>
      </form>

      <button
        type="button"
        className={styles.linkBtn}
        onClick={() => { logout(); navigate('/login'); }}
      >
        Voltar ao login
      </button>
    </AuthLayout>
  );
}
