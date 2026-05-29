import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api.js';
import MetricConfirmModal from '../components/MetricConfirmModal.jsx';
import styles from './Upload.module.css';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const TODAY = new Date().toISOString().split('T')[0];
const MAX_FILES = 10;

let _nextId = 0;
function makeItem(file) {
  _nextId++;
  const raw = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
  return {
    localId: _nextId,
    file,
    preview: URL.createObjectURL(file),
    title: raw || 'Post sem título',
    platform: 'instagram',
    date: TODAY,
  };
}

export default function Upload() {
  const navigate = useNavigate();

  const [fileItems, setFileItems] = useState([]);
  const [formError, setFormError] = useState('');

  // Processing
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Confirmation modal (one at a time, driven by a Promise)
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const [doneAll, setDoneAll] = useState(false);

  // ── Dropzone ────────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted) => {
    setFormError('');
    setFileItems((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        setFormError(`Máximo de ${MAX_FILES} imagens atingido.`);
        return prev;
      }
      return [...prev, ...accepted.slice(0, remaining).map(makeItem)];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    onDropRejected: () => setFormError('Arquivo inválido. Use JPG, PNG ou WEBP com até 10MB.'),
  });

  // ── Item helpers ─────────────────────────────────────────────────────────────

  const removeItem = (localId) => {
    setFileItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.localId !== localId);
    });
  };

  const updateItem = (localId, field, value) => {
    setFileItems((prev) => prev.map((i) => (i.localId === localId ? { ...i, [field]: value } : i)));
  };

  const clearAll = () => {
    fileItems.forEach((i) => URL.revokeObjectURL(i.preview));
    setFileItems([]);
    setFormError('');
  };

  // ── Confirmation gate (blocks the upload loop until user confirms) ───────────

  const waitForConfirmation = (data) =>
    new Promise((resolve) => {
      setIsConfirming(true);
      setPendingConfirm({ ...data, resolve });
    });

  const handleModalConfirm = () => {
    if (pendingConfirm) {
      pendingConfirm.resolve();
      setPendingConfirm(null);
      setIsConfirming(false);
    }
  };

  const handleModalClose = () => {
    // Dismiss without saving metrics — post stays in DB, user can confirm later
    if (pendingConfirm) {
      pendingConfirm.resolve();
      setPendingConfirm(null);
      setIsConfirming(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fileItems.length === 0) {
      setFormError('Adicione pelo menos uma imagem.');
      return;
    }
    const missing = fileItems.find((i) => !i.title.trim());
    if (missing) {
      setFormError('Todos os posts precisam de um título.');
      return;
    }

    setFormError('');
    setProcessing(true);
    setTotalCount(fileItems.length);
    setProcessedCount(0);

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setCurrentLabel(item.title || item.file.name);
      setIsConfirming(false);

      try {
        const formData = new FormData();
        formData.append('image', item.file);
        formData.append('title', item.title.trim());
        formData.append('published_at', item.date);
        formData.append('platform', item.platform);

        const res = await api.post('/posts/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });

        const { post_id, metrics_extracted, confidence, notes } = res.data;

        await waitForConfirmation({
          postId: post_id,
          metrics: metrics_extracted || {},
          confidence: confidence || 'medium',
          notes: notes || '',
        });
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        console.error(`Erro ao enviar "${item.title}":`, msg);
        // Non-fatal: skip this file but continue with others
      }

      setProcessedCount(i + 1);
    }

    setProcessing(false);
    setDoneAll(true);
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (doneAll) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Novo Upload</h1>
        </div>
        <div className="alert alert-success">
          ✓ {processedCount} post{processedCount !== 1 ? 's' : ''} enviado{processedCount !== 1 ? 's' : ''} com sucesso! Redirecionando...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Novo Upload</h1>
        {fileItems.length > 0 && !processing && (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
            {fileItems.length}/{MAX_FILES} imagens selecionadas
          </span>
        )}
      </div>

      {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}

      {/* Progress indicator */}
      {processing && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: '28px 24px' }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto 14px', display: 'block' }} />
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {isConfirming
              ? `Confirme as métricas (${processedCount + 1} de ${totalCount})`
              : `Analisando com IA (${processedCount + 1} de ${totalCount})`}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font)', marginBottom: 16 }}>
            {currentLabel}
          </p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(processedCount / totalCount) * 100}%` }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font)', marginTop: 8 }}>
            {processedCount} de {totalCount} concluídos
          </p>
        </div>
      )}

      {!processing && (
        <form onSubmit={handleSubmit} noValidate>
          {/* Dropzone — only visible if below limit */}
          {fileItems.length < MAX_FILES && (
            <div
              {...getRootProps()}
              className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}
              style={{ marginBottom: fileItems.length > 0 ? 20 : 0 }}
            >
              <input {...getInputProps()} />
              <span className={styles.uploadIcon}>☁</span>
              <p className={styles.dropText}>
                {isDragActive ? 'Solte as imagens aqui' : 'Arraste imagens ou clique para selecionar'}
              </p>
              <p className={styles.dropHint}>
                Até {MAX_FILES} imagens — JPG, PNG, WEBP — 10MB cada
              </p>
              {fileItems.length > 0 && (
                <p className={styles.dropHint} style={{ marginTop: 4 }}>
                  Você pode adicionar mais {MAX_FILES - fileItems.length} imagem{MAX_FILES - fileItems.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* File queue */}
          {fileItems.length > 0 && (
            <div className={styles.fileList}>
              {fileItems.map((item, idx) => (
                <div key={item.localId} className={styles.fileCard}>
                  <div className={styles.fileThumb}>
                    <img src={item.preview} alt="" />
                    <span className={styles.fileIdx}>{idx + 1}</span>
                  </div>
                  <div className={styles.fileFields}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Título do post"
                      value={item.title}
                      onChange={(e) => updateItem(item.localId, 'title', e.target.value)}
                    />
                    <div className={styles.fileFieldsRow}>
                      <select
                        className="form-control"
                        value={item.platform}
                        onChange={(e) => updateItem(item.localId, 'platform', e.target.value)}
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="form-control"
                        value={item.date}
                        onChange={(e) => updateItem(item.localId, 'date', e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeItem(item.localId)}
                    title="Remover"
                    aria-label="Remover imagem"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {fileItems.length > 0 && (
            <div className={styles.actions}>
              <button type="button" className="btn btn-secondary" onClick={clearAll}>
                Limpar tudo
              </button>
              <button type="submit" className="btn btn-primary">
                📤 Enviar {fileItems.length} post{fileItems.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Confirmation modal — opens once per file */}
      <MetricConfirmModal
        isOpen={!!pendingConfirm}
        metrics={pendingConfirm?.metrics || {}}
        postId={pendingConfirm?.postId}
        confidence={pendingConfirm?.confidence}
        notes={pendingConfirm?.notes}
        onConfirm={handleModalConfirm}
        onClose={handleModalClose}
      />
    </div>
  );
}
