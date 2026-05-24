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

export default function Upload() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(TODAY);
  const [platform, setPlatform] = useState('instagram');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [extractedMetrics, setExtractedMetrics] = useState(null);
  const [postId, setPostId] = useState(null);
  const [confidence, setConfidence] = useState('high');
  const [aiNotes, setAiNotes] = useState('');

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setUploadError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20 MB
    onDropRejected: () => setUploadError('Arquivo inválido. Use imagens JPG, PNG ou WEBP com até 20MB.'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');

    if (!file) {
      setUploadError('Selecione uma imagem do post.');
      return;
    }
    if (!title.trim()) {
      setUploadError('Informe um título para o post.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('title', title.trim());
      formData.append('published_date', date);
      formData.append('platform', platform);

      const res = await api.post('/posts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 60s for AI processing
      });

      const { id, metrics, confidence: conf, notes } = res.data;
      setPostId(id);
      setExtractedMetrics(metrics || {});
      setConfidence(conf || 'medium');
      setAiNotes(notes || '');
      setModalOpen(true);
    } catch (err) {
      setUploadError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Erro ao enviar o post. Tente novamente.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = (confirmedMetrics) => {
    setModalOpen(false);
    setSuccessMsg('Post enviado e métricas confirmadas com sucesso!');
    setTimeout(() => navigate('/dashboard'), 2200);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Novo Upload</h1>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          ✓ {successMsg}
        </div>
      )}

      <div className={styles.uploadLayout}>
        {/* Left: form */}
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
                disabled={uploading || !file}
              >
                {uploading ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Analisando métricas com IA...
                  </>
                ) : (
                  '📤 Analisar e Salvar'
                )}
              </button>

              {uploading && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, fontFamily: 'Arial' }}>
                  Isso pode levar até 15 segundos. Por favor, aguarde.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right: dropzone + preview */}
        <div className={styles.dropSection}>
          {preview ? (
            <div className={styles.previewWrapper}>
              <img src={preview} alt="Preview" className={styles.previewImg} />
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={handleRemoveFile}
                disabled={uploading}
              >
                ✕ Remover imagem
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}
            >
              <input {...getInputProps()} />
              <span className={styles.uploadIcon}>☁</span>
              <p className={styles.dropText}>
                {isDragActive ? 'Solte a imagem aqui' : 'Arraste uma imagem ou clique para selecionar'}
              </p>
              <p className={styles.dropHint}>JPG, PNG, WEBP — até 20MB</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 16 }}
                onClick={(e) => e.stopPropagation()}
              >
                Selecionar arquivo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metric confirmation modal */}
      <MetricConfirmModal
        isOpen={modalOpen}
        metrics={extractedMetrics}
        postId={postId}
        confidence={confidence}
        notes={aiNotes}
        onConfirm={handleConfirm}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
