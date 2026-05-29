import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import styles from './Profile.module.css';

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const has8 = password.length >= 8;
  const hasNum = /\d/.test(password);
  const hasSym = /[!@#$%^&*(),.?":{}|<>_\-]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const score = [has8, hasNum, hasSym, hasUpper].filter(Boolean).length;
  const colors = ['', '#B42318', '#D97706', '#FFD400', '#1F8A4C'];
  const labels = ['', 'Fraca', 'Regular', 'Boa', 'Forte'];

  return (
    <div className={styles.strengthWrap}>
      <div className={styles.strengthBar}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={styles.strengthSegment}
            style={{ background: i <= score ? colors[score] : 'var(--border)' }}
          />
        ))}
      </div>
      <span className={styles.strengthLabel} style={{ color: score > 0 ? colors[score] : 'var(--ink-muted)' }}>
        {score > 0 ? labels[score] : ''}
      </span>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [initialBio, setInitialBio] = useState('');

  const [savingInfo, setSavingInfo] = useState(false);
  const [infoErr, setInfoErr] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const fileRef = useRef(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState('');

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    let mounted = true;
    api.get('/profile')
      .then((res) => {
        if (!mounted) return;
        const name = res.data.display_name || '';
        const b = res.data.bio || '';
        setDisplayName(name);
        setBio(b);
        setInitialDisplayName(name);
        setInitialBio(b);
        setAvatarUrl(res.data.avatar_url || null);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const hasInfoChanges = displayName !== initialDisplayName || bio !== initialBio;

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setInfoErr('');
    if (!displayName.trim()) {
      setInfoErr('O nome nao pode ficar em branco.');
      return;
    }
    setSavingInfo(true);
    try {
      const res = await api.put('/profile', { display_name: displayName.trim(), bio });
      updateUser({ display_name: res.data.display_name, bio: res.data.bio });
      setInitialDisplayName(displayName.trim());
      setInitialBio(bio);
      showToast('Informacoes atualizadas com sucesso');
    } catch (err) {
      setInfoErr(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleAvatarPick = () => fileRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarErr('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.avatar_url);
      updateUser({ avatar_url: res.data.avatar_url });
      showToast('Foto de perfil atualizada');
    } catch (err) {
      setAvatarErr(err.response?.data?.error || 'Erro ao enviar a foto.');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSavePwd = async (e) => {
    e.preventDefault();
    setPwdErr('');
    if (newPwd.length < 8) {
      setPwdErr('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdErr('As senhas nao coincidem.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.post('/profile/password', { current_password: currentPwd, new_password: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      showToast('Senha alterada com sucesso');
    } catch (err) {
      setPwdErr(err.response?.data?.error || 'Erro ao alterar a senha.');
    } finally {
      setSavingPwd(false);
    }
  };

  const initial = (displayName || user?.username || 'U')[0]?.toUpperCase();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Atualizar Perfil</h1>
      </div>

      <div className={styles.grid}>
        {/* Avatar + info */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 20 }}>Informacoes pessoais</h2>

          <div className={styles.avatarRow}>
            <div className={styles.avatarWrap} onClick={handleAvatarPick} title="Alterar foto">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>{initial}</div>
              )}
              <div className={styles.avatarOverlay}>
                <IconCamera />
              </div>
            </div>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAvatarPick}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Enviando...' : 'Trocar foto'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <p className={styles.hint}>JPG, PNG ou WEBP — ate 5MB</p>
              {avatarErr && <p className={styles.fieldErr}>{avatarErr}</p>}
            </div>
          </div>

          <form onSubmit={handleSaveInfo} noValidate>
            {infoErr && <div className="alert alert-error">{infoErr}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="display_name">Nome</label>
              <input
                id="display_name"
                type="text"
                className="form-control"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading || savingInfo}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bio">Mini bio</label>
              <textarea
                id="bio"
                className="form-control"
                rows={3}
                maxLength={280}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte um pouco sobre voce..."
                disabled={loading || savingInfo}
                style={{ resize: 'vertical' }}
              />
              <span className={styles.counter}>{bio.length}/280</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingInfo || !hasInfoChanges}>
              {savingInfo ? 'Salvando...' : 'Salvar informacoes'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 20 }}>Alterar senha</h2>
          <form onSubmit={handleSavePwd} noValidate>
            {pwdErr && <div className="alert alert-error">{pwdErr}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="current_pwd">Senha atual</label>
              <div className={styles.pwdWrapper}>
                <input
                  id="current_pwd"
                  type={showCurrentPwd ? 'text' : 'password'}
                  className={`form-control ${styles.pwdInput}`}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  autoComplete="current-password"
                  disabled={savingPwd}
                />
                <button type="button" className={styles.pwdEye} onClick={() => setShowCurrentPwd((v) => !v)} tabIndex={-1}>
                  {showCurrentPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new_pwd">Nova senha</label>
              <div className={styles.pwdWrapper}>
                <input
                  id="new_pwd"
                  type={showNewPwd ? 'text' : 'password'}
                  className={`form-control ${styles.pwdInput}`}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  autoComplete="new-password"
                  disabled={savingPwd}
                />
                <button type="button" className={styles.pwdEye} onClick={() => setShowNewPwd((v) => !v)} tabIndex={-1}>
                  {showNewPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <PasswordStrength password={newPwd} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm_pwd">Confirmar nova senha</label>
              <div className={styles.pwdWrapper}>
                <input
                  id="confirm_pwd"
                  type={showConfirmPwd ? 'text' : 'password'}
                  className={`form-control ${styles.pwdInput}`}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  disabled={savingPwd}
                />
                <button type="button" className={styles.pwdEye} onClick={() => setShowConfirmPwd((v) => !v)} tabIndex={-1}>
                  {showConfirmPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}>
              {savingPwd ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className={styles.toast}>
          <IconCheck />
          {toast}
        </div>
      )}
    </div>
  );
}
