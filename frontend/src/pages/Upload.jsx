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

  // Post-level fields (one post)
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(TODAY);
  const [platform, setPlatform] = useState('instagram');

  // Prints for this single post
  const [prints, setPrints] = useState([]); // [{ localId, file, preview }]

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation modal
  const [modalOpen, setModalOpen] = useState(false);
  const [extractedMetrics, setExtractedMetrics] = useState(null);
  const [postId, setPostId] = useState(null);
  const [confidence, setConfidence] = useState('medium');
  const [aiNotes, setAiNotes] = useState('');
  const [aiError, setAiError] = useState('');

  // ── Dropzone ─────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted) => {
    setUploadError('');
    setPrints((prev) => {
      const remaining = MAX_PRINTS - prev.length;
      if (remaining <= 0) {
        setUploadError(`Máximo de ${MAX_PRINTS} prints por post.`);
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
      setUploadError('Adicione pelo menos um print do post.');
      return;
    }
    if (!title.trim()) {
      setUploadError('Informe um título para o post.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      prints.forEach((p) => formData.append('images', p.file));
      formData.append('title', title.trim());
      formData.append('published_at', date);
      formData.append('platform', platform);

      const res = await api.post('/posts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000, // up to 90s for analyzing several prints
      });

      const { post_id, metrics_extracted, confidence: conf, notes, ai_error } = res.data;
      setPostId(post_id);
      setExtractedMetrics(metrics_extracted || {});
      setConfidence(conf || 'medium');
      setAiNotes(notes || '');
      setAiError(ai_error || '');
      setModalOpen(true);
    } catch (err) {
      setUploadError(
        err.response?.data?.error || 'Erro ao enviar o post. Tente novamente.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    setModalOpen(false);
    setSuccessMsg('Post enviado e métricas confirmadas com sucesso!');
    prints.forEach((p) => URL.revokeObjectURL(p.preview));
    setTimeout(() => navigate('/dashboard'), 2000);
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

      <div className={styles.uploadLayout}>
        {/* Left: post info form */}
        <div className={styles.formSection}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Informações do Post</h2>

            <form onSubmit={handleSubmit} noValidate>
              {uploadError && <div className="alert alert-error">{uploadError}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="title">Título do post</label>
                <input
                  id="title"
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Post sobre coworking em SP"
                  disabled={uploading}
                />
              </div>

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
                  A IA está lendo todos os prints e consolidando as métricas. Aguarde.
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
                Vários prints do mesmo post — até {MAX_PRINTS} — JPG, PNG, WEBP — 10MB cada
              </p>
            </div>
          )}

          {prints.length > 0 && (
            <>
              <div className={styles.printCount}>
                {prints.length}/{MAX_PRINTS} prints adicionados
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

      {/* Metric confirmation modal (consolidated metrics for the post) */}
      <MetricConfirmModal
        isOpen={modalOpen}
        metrics={extractedMetrics}
        postId={postId}
        confidence={confidence}
        notes={aiNotes}
        aiError={aiError}
        onConfirm={handleConfirm}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
