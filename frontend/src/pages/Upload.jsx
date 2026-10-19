import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api.js';
import MetricConfirmModal from '../components/MetricConfirmModal.jsx';
import { IconUpload } from '../components/Icons.jsx';
import styles from './Upload.module.css';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const TODAY = new Date().toISOString().split('T')[0];
const MAX_PRINTS = 10;

let _nextId = 0;

export default function Upload() {
  const navigate = useNavigate();

  // Shared metadata for the whole batch (not visible in a screenshot).
  const [date, setDate] = useState(TODAY);
  const [platform, setPlatform] = useState('instagram');

  // Each print becomes its own post — no grouping anymore.
  const [prints, setPrints] = useState([]); // [{ localId, file, preview }]

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation queue: one post at a time, in the order the AI returned them.
  const [queue, setQueue] = useState([]); // [{ post_id, title, post_type, metrics_extracted, confidence, notes, needs_manual_entry }]
  const [queueIndex, setQueueIndex] = useState(0);
  const [batchAiError, setBatchAiError] = useState('');

  // ── Dropzone ─────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted) => {
    setUploadError('');
    setPrints((prev) => {
      const remaining = MAX_PRINTS - prev.length;
      if (remaining <= 0) {
        setUploadError(`Máximo de ${MAX_PRINTS} prints por vez.`);
        return prev;
      }
      const added = accepted.slice(0, remaining).map((file) => {
        _nextId++;
        return { localId: _nextId, file, preview: URL.createObjectURL(file) };
      });
      return [...prev, ...added];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    onDropRejected: () => setUploadError('Arquivo inválido. Use JPG, PNG ou WEBP com até 10MB.'),
  });

  const removePrint = (localId) => {
    setPrints((prev) => {
      const item = prev.find((p) => p.localId === localId);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');

    if (prints.length === 0) {
      setUploadError('Adicione pelo menos um print.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      prints.forEach((p) => formData.append('images', p.file));
      formData.append('published_at', date);
      formData.append('platform', platform);

      const res = await api.post('/posts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 150000, // headroom: storage uploads + bounded AI extraction (90s)
      });

      const { posts: createdPosts, ai_error } = res.data;
      if (!createdPosts || createdPosts.length === 0) {
        setUploadError('Nenhum post foi criado. Tente novamente.');
        return;
      }
      setBatchAiError(ai_error || '');
      setQueue(createdPosts);
      setQueueIndex(0);
    } catch (err) {
      if (err.response) {
        // Server answered with an error — safe to show and retry.
        setUploadError(err.response.data?.error || 'Erro ao enviar os prints. Tente novamente.');
      } else {
        // No response reached the browser (timeout, connection dropped, etc.):
        // the server may have finished creating posts anyway. Don't let the
        // user blindly resubmit and risk duplicates.
        setUploadError(
          'A conexão demorou demais ou foi interrompida antes da resposta chegar. ' +
          'Os posts PODEM já ter sido criados no servidor — confira no seu Dashboard antes ' +
          'de enviar novamente.'
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const currentPost = queue[queueIndex] || null;

  const handleConfirmOne = () => {
    if (queueIndex + 1 < queue.length) {
      setQueueIndex((i) => i + 1);
    } else {
      // Batch finished
      setQueue([]);
      setQueueIndex(0);
      prints.forEach((p) => URL.revokeObjectURL(p.preview));
      setPrints([]);
      setSuccessMsg(`${queue.length} post${queue.length !== 1 ? 's' : ''} enviado${queue.length !== 1 ? 's' : ''} e confirmado${queue.length !== 1 ? 's' : ''} com sucesso!`);
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  const handleCloseModal = () => {
    // Closing mid-queue just skips that post's confirmation for now — it
    // stays saved as pending (needs_manual_entry/unconfirmed) and can be
    // confirmed later from the Dashboard, same as a normal unconfirmed post.
    if (queueIndex + 1 < queue.length) {
      setQueueIndex((i) => i + 1);
    } else {
      setQueue([]);
      setQueueIndex(0);
      prints.forEach((p) => URL.revokeObjectURL(p.preview));
      setPrints([]);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Novo Post</h1>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          {successMsg}
        </div>
      )}

      {batchAiError && queue.length === 0 && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          A IA não conseguiu classificar os prints automaticamente: {batchAiError}. Preencha as métricas manualmente em cada post.
        </div>
      )}

      <div className={styles.uploadLayout}>
        {/* Left: shared batch info */}
        <div className={styles.formSection}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Informações do Lote</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -12, marginBottom: 16 }}>
              Cada print vira um post separado. A IA identifica sozinha se é Feed ou Story e lê as métricas de cada um.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {uploadError && <div className="alert alert-error">{uploadError}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="platform">Plataforma</label>
                <select
                  id="platform"
                  className="form-control"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  disabled={uploading}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="date">Data de publicação</label>
                <input
                  id="date"
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={uploading || prints.length === 0}
              >
                {uploading ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Analisando {prints.length} print{prints.length !== 1 ? 's' : ''} com IA...
                  </>
                ) : (
                  `Analisar e Salvar (${prints.length} print${prints.length !== 1 ? 's' : ''})`
                )}
              </button>

              {uploading && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, fontFamily: 'var(--font)' }}>
                  A IA está identificando o formato (Feed/Story) e lendo as métricas de cada print. Aguarde.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right: multi-print dropzone + thumbnails */}
        <div className={styles.dropSection}>
          {prints.length < MAX_PRINTS && (
            <div
              {...getRootProps()}
              className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}
            >
              <input {...getInputProps()} />
              <span className={styles.uploadIcon}>☁</span>
              <p className={styles.dropText}>
                {isDragActive ? 'Solte os prints aqui' : 'Arraste os prints ou clique para selecionar'}
              </p>
              <p className={styles.dropHint}>
                Cada print = um post — até {MAX_PRINTS} de uma vez — JPG, PNG, WEBP — 10MB cada
              </p>
            </div>
          )}

          {prints.length > 0 && (
            <>
              <div className={styles.printCount}>
                {prints.length}/{MAX_PRINTS} prints adicionados ({prints.length} post{prints.length !== 1 ? 's' : ''} será{prints.length !== 1 ? 'ão' : ''} criado{prints.length !== 1 ? 's' : ''})
              </div>
              <div className={styles.thumbGrid}>
                {prints.map((p, idx) => (
                  <div key={p.localId} className={styles.thumb}>
                    <img src={p.preview} alt={`Print ${idx + 1}`} />
                    <span className={styles.thumbIdx}>{idx + 1}</span>
                    {!uploading && (
                      <button
                        type="button"
                        className={styles.thumbRemove}
                        onClick={() => removePrint(p.localId)}
                        aria-label="Remover print"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metric confirmation modal — one post at a time through the queue */}
      <MetricConfirmModal
        isOpen={!!currentPost}
        metrics={currentPost?.metrics_extracted || {}}
        postId={currentPost?.post_id}
        postType={currentPost?.post_type}
        confidence={currentPost?.confidence}
        notes={currentPost?.notes}
        aiError={!currentPost?.metrics_extracted && batchAiError ? batchAiError : ''}
        progressLabel={queue.length > 1 ? `Post ${queueIndex + 1} de ${queue.length} — ${currentPost?.title || ''}` : currentPost?.title}
        onConfirm={handleConfirmOne}
        onClose={handleCloseModal}
      />
    </div>
  );
}
