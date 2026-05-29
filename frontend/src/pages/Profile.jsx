import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [infoErr, setInfoErr] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const fileRef = useRef(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/profile')
      .then((res) => {
        if (!mounted) return;
        setDisplayName(res.data.display_name || '');
        setBio(res.data.bio || '');
        setAvatarUrl(res.data.avatar_url || null);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setInfoMsg(''); setInfoErr('');
    if (!displayName.trim()) {
      setInfoErr('O nome não pode ficar em branco.');
      return;
    }
    setSavingInfo(true);
    try {
      const res = await api.put('/profile', { display_name: displayName.trim(), bio });
      updateUser({ display_name: res.data.display_name, bio: res.data.bio });
      setInfoMsg('Informações atualizadas com sucesso.');
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
    } catch (err) {
      setAvatarErr(err.response?.data?.error || 'Erro ao enviar a foto.');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSavePwd = async (e) => {
    e.preventDefault();
    setPwdMsg(''); setPwdErr('');
    if (newPwd.length < 8) {
      setPwdErr('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdErr('As senhas não coincidem.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.post('/profile/password', { current_password: currentPwd, new_password: newPwd });
      setPwdMsg('Senha alterada com sucesso.');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
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
          <h2 className="section-title" style={{ marginBottom: 20 }}>Informações pessoais</h2>

          <div className={styles.avatarRow}>
            <div className={styles.avatarWrap}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>{initial}</div>
              )}
            </div>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAvatarPick}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Enviando...' : '📷 Trocar foto'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <p className={styles.hint}>JPG, PNG ou WEBP — até 5MB</p>
              {avatarErr && <p className={styles.fieldErr}>{avatarErr}</p>}
            </div>
          </div>

          <form onSubmit={handleSaveInfo} noValidate>
            {infoErr && <div className="alert alert-error">{infoErr}</div>}
            {infoMsg && <div className="alert alert-success">{infoMsg}</div>}

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
                placeholder="Conte um pouco sobre você..."
                disabled={loading || savingInfo}
                style={{ resize: 'vertical' }}
              />
              <span className={styles.counter}>{bio.length}/280</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingInfo}>
              {savingInfo ? 'Salvando...' : 'Salvar informações'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 20 }}>Alterar senha</h2>
          <form onSubmit={handleSavePwd} noValidate>
            {pwdErr && <div className="alert alert-error">{pwdErr}</div>}
            {pwdMsg && <div className="alert alert-success">{pwdMsg}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="current_pwd">Senha atual</label>
              <input
                id="current_pwd"
                type="password"
                className="form-control"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                disabled={savingPwd}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new_pwd">Nova senha</label>
              <input
                id="new_pwd"
                type="password"
                className="form-control"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                disabled={savingPwd}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm_pwd">Confirmar nova senha</label>
              <input
                id="confirm_pwd"
                type="password"
                className="form-control"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                disabled={savingPwd}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPwd}>
              {savingPwd ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
