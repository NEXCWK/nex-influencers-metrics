import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api.js';
import MetricConfirmModal from '../components/MetricConfirmModal.jsx';
import { IconCloudUpload, IconX, IconSparkles, IconCheck, IconAlert } from '../components/Icons.jsx';
import { PageHeader, Spinner } from '../components/ui.jsx';
import { PLATFORMS, localToday } from '../utils/format.js';
import styles from './Upload.module.css';

const MAX_PRINTS = 10;

let _nextId = 0;

export default function Upload() {
  const navigate = useNavigate();

  // Shared metadata for the whole batch (not visible in a screenshot).
  // Local date — toISOString() would jump to tomorrow after 21h in Brazil.
  const [date, setDate] = useState(localToday);
  const [platform, setPlatform] = useState('instagram');

  // Each print becomes its own post — no grouping anymore.
  const [prints, setPrints] = useState([]); // [{ localId, file, preview }]

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation queue: one post at a time, in the order the AI returned them.
  const [queue, setQueue] = useState([]); // [{ post_id, print_index, title, post_type, metrics_extracted, confidence, notes, needs_manual_entry }]
  const [queueIndex, setQueueIndex] = useState(0);
  const [batchAiError, setBatchAiError] = useState('');

  // ── Dropzone ─────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted) => {
    setUploadError('');
    setSuccessMsg('');
    setPrints((prev) => {
      const remaining = MAX_PRINTS - prev.length;
      if (remaining <= 0) {
        setUploadError(`Máximo de ${MAX_PRINTS} prints por vez.`);
        return prev;
      }
      if (accepted.length > remaining) {
        setUploadError(`Máximo de ${MAX_PRINTS} prints por vez — ${accepted.length - remaining} não ${accepted.length - remaining === 1 ? 'foi adicionado' : 'foram adicionados'}.`);
      }
      const added = accepted.slice(0, remaining).map((file) => {
        _nextId++;
        return { localId: _nextId, file, preview: URL.createObjectURL(file) };
      });
      return [...prev, ...added];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    disabled: uploading,
    noClick: prints.length > 0,
    onDropRejected: () => setUploadError('Arquivo inválido. Use JPG, PNG ou WEBP com até 10MB.'),
  });

  const removePrint = (localId) => {
    setPrints((prev) => {
      const item = prev.find((p) => p.localId === localId);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  const clearPrints = () => {
    prints.forEach((p) => URL.revokeObjectURL(p.preview));
    setPrints([]);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');
    setSuccessMsg('');

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
      clearPrints();
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
      clearPrints();
    }
  };

  const currentPreview = currentPost && Number.isInteger(currentPost.print_index)
    ? prints[currentPost.print_index]?.preview
    : undefined;

  const n = prints.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Enviar posts"
        subtitle="Envie os prints das métricas. Cada print vira um post — a IA identifica se é Feed ou Story e lê os números para você conferir."
      />

      {successMsg && (
        <div className="alert alert-success">
          <IconCheck size={16} />
          <span>{successMsg} Redirecionando para o seu painel…</span>
        </div>
      )}

      {batchAiError && queue.length === 0 && (
        <div className="alert alert-error">
          <IconAlert size={16} />
          <span>A IA não conseguiu classificar os prints automaticamente: {batchAiError}. Preencha as métricas manualmente em cada post.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={styles.uploadLayout}>
        {/* Main: dropzone + thumbnails */}
        <div className={styles.dropSection}>
          <div
            {...getRootProps()}
            className={[
              styles.dropzone,
              isDragActive ? styles.dragActive : '',
              n > 0 ? styles.dropzoneFilled : '',
            ].join(' ')}
          >
            <input {...getInputProps()} />
            {n === 0 ? (
              <div className={styles.dropEmpty}>
                <span className={styles.uploadIcon}><IconCloudUpload size={26} /></span>
                <p className={styles.dropText}>
                  {isDragActive ? 'Solte os prints aqui' : 'Arraste os prints ou clique para selecionar'}
                </p>
                <p className={styles.dropHint}>
                  Até {MAX_PRINTS} prints por envio · JPG, PNG ou WEBP · 10 MB cada
                </p>
              </div>
            ) : (
              <>
                <div className={styles.thumbHeader}>
                  <span className={styles.printCount}>
                    {n} de {MAX_PRINTS} prints · {n} post{n !== 1 ? 's' : ''} ser{n !== 1 ? 'ão' : 'á'} criado{n !== 1 ? 's' : ''}
                  </span>
                  {!uploading && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearPrints}>
                      Limpar
                    </button>
                  )}
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
                          onClick={(e) => { e.stopPropagation(); removePrint(p.localId); }}
                          aria-label={`Remover print ${idx + 1}`}
                        >
                          <IconX size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {n < MAX_PRINTS && !uploading && (
                    <button type="button" className={styles.addMore} onClick={open}>
                      <IconCloudUpload size={18} />
                      Adicionar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Side: batch info + submit */}
        <aside className={styles.side}>
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 4 }}>Informações do envio</h2>
            <p className="card-subtitle" style={{ marginBottom: 18 }}>Valem para todos os prints deste lote.</p>

            {uploadError && (
              <div className="alert alert-error">
                <IconAlert size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="form-group">
              <span className="form-label" id="platform-label">Plataforma</span>
              <div className={styles.platformGrid} role="radiogroup" aria-labelledby="platform-label">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={platform === p.value}
                    className={`${styles.platformOption} ${platform === p.value ? styles.platformActive : ''}`}
                    onClick={() => setPlatform(p.value)}
                    disabled={uploading}
                  >
                    <span className={`platform-label platform-${p.value}`}>{p.label}</span>
                  </button>
                ))}
              </div>
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
              <p className="form-hint">Define em qual mês os posts entram no painel.</p>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={uploading || n === 0}
            >
              {uploading ? (
                <><Spinner /> Analisando {n} print{n !== 1 ? 's' : ''}…</>
              ) : (
                <><IconSparkles size={16} /> Analisar e salvar{n > 0 ? ` (${n})` : ''}</>
              )}
            </button>

            {uploading && (
              <p className="form-hint" style={{ textAlign: 'center', marginTop: 10 }}>
                A IA está identificando o formato (Feed/Story) e lendo as métricas de cada print. Aguarde.
              </p>
            )}
          </div>

          <ol className={styles.steps}>
            <li><span><strong>Envie os prints</strong> das telas de métricas de cada post.</span></li>
            <li><span><strong>A IA lê os números</strong> e identifica Feed ou Story.</span></li>
            <li><span><strong>Confira e confirme</strong> cada post antes de salvar.</span></li>
          </ol>
        </aside>
      </form>

      {/* Metric confirmation modal — one post at a time through the queue */}
      <MetricConfirmModal
        isOpen={!!currentPost}
        metrics={currentPost?.metrics_extracted}
        postId={currentPost?.post_id}
        postType={currentPost?.post_type}
        confidence={currentPost?.confidence}
        notes={currentPost?.notes}
        previewUrl={currentPreview}
        aiError={!currentPost?.metrics_extracted && batchAiError ? batchAiError : ''}
        progressLabel={queue.length > 1 ? `Post ${queueIndex + 1} de ${queue.length} — ${currentPost?.title || ''}` : currentPost?.title}
        onConfirm={handleConfirmOne}
        onClose={handleCloseModal}
      />
    </>
  );
}
