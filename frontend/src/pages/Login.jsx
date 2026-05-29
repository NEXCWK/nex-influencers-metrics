import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUsernameError('');
    setPasswordError('');

    let hasError = false;
    if (!username.trim()) {
      setUsernameError('Informe seu usuário.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Informe sua senha.');
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      if (user.must_change_password) {
        navigate('/change-password', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Usuário ou senha incorretos.';
      setPasswordError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page} data-dark={dark ? 'true' : undefined}>

      {/* Dark mode toggle */}
      <button
        className={styles.themeToggle}
        onClick={() => setDark((d) => !d)}
        aria-label={dark ? 'Modo claro' : 'Modo escuro'}
        title={dark ? 'Modo claro' : 'Modo escuro'}
      >
        {dark ? <IconSun /> : <IconMoon />}
      </button>

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.logoArea}>
          <img src="/images/logo-nex-preto.png" alt="Nex" className={styles.logoImg} />
          <span className={styles.badge}>Influencer Metrics</span>
        </div>

        <h1 className={styles.title}>Entrar na plataforma</h1>
        <p className={styles.subtitle}>Acesso restrito a usuários cadastrados.</p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Username */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="username">Usuário</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><IconUser /></span>
              <input
                id="username"
                type="text"
                className={styles.input}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }}
                placeholder="seu.usuario"
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>
            {usernameError && <span className={styles.fieldError}>{usernameError}</span>}
          </div>

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="password">Senha</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><IconLock /></span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputPassword}`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {passwordError && <span className={styles.fieldError}>{passwordError}</span>}
          </div>

          {/* Submit */}
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <>
                <span className={styles.btnSpinner} />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>

        </form>

        {/* Footer */}
        <hr className={styles.footerSep} />
        <p className={styles.footer}>Nex Coworking &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
