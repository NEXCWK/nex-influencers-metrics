import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import { flattenPosts, flattenRanking } from '../utils/normalize.js';
import {
  IconDownload, IconImage, IconEye, IconPencil, IconRefresh, IconTrash, IconSparkles,
  IconChevronDown, IconCpu, IconX,
} from '../components/Icons.jsx';
import {
  FormatBadge, DuplicateBadge, MetricCell, PostLink, PlatformLabel, PostThumb,
} from '../components/PostBadges.jsx';
import EditPostModal from '../components/EditPostModal.jsx';
import PostDetailModal from '../components/PostDetailModal.jsx';
import { PageHeader, EmptyState, Skeleton, Menu, MenuItem, Spinner } from '../components/ui.jsx';
import {
  MONTHS, PLATFORMS, currentYear, yearOptions, formatCompact, formatDate, platformLabel,
} from '../utils/format.js';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: '', label: 'Data de publicação (mais recente)' },
  { value: 'recent', label: 'Data de envio ao sistema' },
  { value: 'best_views', label: 'Mais visualizações' },
  { value: 'best_reach', label: 'Maior alcance' },
  { value: 'best_likes', label: 'Mais curtidas' },
];

const METRIC_KEYS = [
  'reach', 'impressions', 'likes', 'comments', 'shares',
  'saves', 'plays', 'engagement_rate', 'profile_visits', 'link_clicks',
];
const isMissingMetrics = (p) => METRIC_KEYS.every((k) => p[k] == null);

export default function AdminAllPosts() {
  const [influencerFilter, setInfluencerFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(String(currentYear()));
  const [platformFilter, setPlatformFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPost, setExpandedPost] = useState(null);
  const [editPost, setEditPost] = useState(null);
  const [reprocessingId, setReprocessingId] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [checkingAi, setCheckingAi] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/admin/influencers').then((res) => {
      setInfluencers(flattenRanking(res.data?.ranking));
    }).catch(() => {});
  }, []);

  // Any filter change goes back to page 1 — staying on page 5 of a narrower
  // result set used to show an empty table.
  const withPageReset = (setter) => (value) => { setter(value); setPage(1); };

  const buildParams = useCallback(() => {
    const p = { page, pageSize: PAGE_SIZE };
    if (influencerFilter) p.influencerId = influencerFilter;
    if (monthFilter) p.month = monthFilter;
    if (yearFilter) p.year = yearFilter;
    if (platformFilter) p.platform = platformFilter;
    if (formatFilter) p.postType = formatFilter;
    if (dateFrom) p.startDate = dateFrom;
    if (dateTo) p.endDate = dateTo;
    if (sortBy) p.sortBy = sortBy;
    return p;
  }, [influencerFilter, monthFilter, yearFilter, platformFilter, formatFilter, dateFrom, dateTo, sortBy, page]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/posts', { params: buildParams() });
      const data = res.data;
      setPosts(flattenPosts(data.posts));
      setTotal(data.total || (data.posts?.length) || 0);
    } catch {
      setError('Erro ao carregar posts.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const clearAllFilters = () => {
    setInfluencerFilter('');
    setMonthFilter('');
    setYearFilter(String(currentYear()));
    setPlatformFilter('');
    setFormatFilter('');
    setDateFrom('');
    setDateTo('');
    setSortBy('');
    setPage(1);
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Excluir o post "${post.title || 'post'}"?`)) return;
    try {
      await api.delete(`/admin/posts/${post.id}`);
      setExpandedPost((p) => (p?.id === post.id ? null : p));
      // Last row of a page → step back; otherwise refetch so the page refills.
      if (posts.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchPosts();
    } catch {
      alert('Erro ao excluir post.');
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/export', {
        params: buildParams(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nex-posts-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking synchronously can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert('Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleEditSaved = () => {
    setEditPost(null);
    // Refetch: editing the date may move the post to another month, so it can
    // leave the current filter — a simple map wouldn't reflect that.
    fetchPosts();
  };

  // Re-run AI extraction on a single post's stored prints.
  const handleReprocess = async (post) => {
    setReprocessingId(post.id);
    try {
      const res = await api.post(`/admin/posts/${post.id}/reprocess`, {}, { timeout: 120000 });
      if (res.data?.skipped) {
        alert('As métricas deste post foram editadas manualmente e não foram sobrescritas. Use "Editar" para ajustar.');
      }
      await fetchPosts();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao reprocessar as métricas deste post.');
    } finally {
      setReprocessingId(null);
    }
  };

  // Re-run AI extraction for EVERY post on the platform (all months/pages),
  // applying the current extraction prompt. Skips manually-edited posts on the
  // backend. Long-running: one AI call per post, so keep the tab open.
  const handleReprocessAll = async () => {
    let ids = [];
    try {
      const res = await api.get('/admin/posts/all-ids');
      ids = res.data?.ids || [];
    } catch {
      alert('Erro ao listar os posts para reprocessar.');
      return;
    }
    if (ids.length === 0) {
      alert('Nenhum post encontrado.');
      return;
    }
    if (!window.confirm(`Reprocessar TODOS os ${ids.length} posts da plataforma? A IA roda uma vez por post, então pode levar vários minutos. Mantenha esta aba aberta.`)) {
      return;
    }
    setBulkProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        await api.post(`/admin/posts/${ids[i]}/reprocess`, {}, { timeout: 120000 });
      } catch {
        // continua para os próximos mesmo se um falhar
      }
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkProgress(null);
    await fetchPosts();
  };

  // Re-run AI extraction for every post on the current page that has no metrics.
  const handleReprocessMissing = async () => {
    const targets = posts.filter(isMissingMetrics);
    if (targets.length === 0) {
      alert('Nenhum post sem métricas nesta página.');
      return;
    }
    if (!window.confirm(`Reprocessar ${targets.length} post(s) sem métricas desta página? A IA será executada novamente sobre os prints já enviados.`)) {
      return;
    }
    setBulkProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      try {
        await api.post(`/admin/posts/${targets[i].id}/reprocess`, {}, { timeout: 120000 });
      } catch {
        // continua para os próximos mesmo se um falhar
      }
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkProgress(null);
    await fetchPosts();
  };

  const handleCheckAiModel = async () => {
    setCheckingAi(true);
    try {
      const res = await api.get('/admin/ai-status');
      const d = res.data || {};
      if (d.ok) {
        alert(
          `✅ IA funcionando normalmente.\n\n` +
          `Modelo configurado: ${d.model}\n` +
          (d.reported_model ? `Modelo confirmado pela Anthropic: ${d.reported_model}\n` : '') +
          `Origem: ${d.configured_via_env ? 'variável de ambiente ANTHROPIC_MODEL' : 'padrão do código'}\n` +
          `Tempo de resposta: ${d.latency_ms}ms`
        );
      } else {
        alert(
          `❌ Falha ao verificar a IA.\n\n` +
          `Modelo configurado: ${d.model}\n` +
          `Origem: ${d.configured_via_env ? 'variável de ambiente ANTHROPIC_MODEL' : 'padrão do código'}\n` +
          `Erro: ${d.error || 'desconhecido'}`
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao verificar o modelo de IA.');
    } finally {
      setCheckingAi(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const missingOnPage = posts.filter(isMissingMetrics).length;

  const activeChips = [];
  if (influencerFilter) {
    const inf = influencers.find((i) => i.id === influencerFilter);
    activeChips.push({ key: 'influencer', label: inf?.display_name || inf?.username || 'Influenciador', clear: () => withPageReset(setInfluencerFilter)('') });
  }
  if (monthFilter) activeChips.push({ key: 'month', label: MONTHS[Number(monthFilter) - 1], clear: () => withPageReset(setMonthFilter)('') });
  if (yearFilter) activeChips.push({ key: 'year', label: yearFilter, clear: () => withPageReset(setYearFilter)('') });
  if (platformFilter) activeChips.push({ key: 'platform', label: platformLabel(platformFilter), clear: () => withPageReset(setPlatformFilter)('') });
  if (formatFilter) activeChips.push({ key: 'format', label: formatFilter === 'story' ? 'Story' : 'Feed', clear: () => withPageReset(setFormatFilter)('') });
  if (dateFrom) activeChips.push({ key: 'dateFrom', label: `De ${formatDate(dateFrom)}`, clear: () => withPageReset(setDateFrom)('') });
  if (dateTo) activeChips.push({ key: 'dateTo', label: `Até ${formatDate(dateTo)}`, clear: () => withPageReset(setDateTo)('') });

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Posts"
        subtitle="Todos os posts enviados pelos influenciadores, com filtros, edição e reprocessamento por IA."
        actions={(
          <>
            <Menu
              buttonClassName="btn btn-secondary"
              trigger={<><IconSparkles size={15} /> Ferramentas de IA <IconChevronDown size={14} /></>}
            >
              <p className="menu-label">Reprocessar métricas</p>
              <MenuItem
                icon={<IconRefresh size={15} />}
                hint={`Posts sem métricas nesta página (${missingOnPage})`}
                onClick={handleReprocessMissing}
                disabled={!!bulkProgress || loading}
              >
                Reprocessar faltantes
              </MenuItem>
              <MenuItem
                icon={<IconRefresh size={15} />}
                hint="Todos os posts da plataforma — pode levar vários minutos"
                onClick={handleReprocessAll}
                disabled={!!bulkProgress || loading}
              >
                Reprocessar todos
              </MenuItem>
              <hr className="menu-divider" />
              <MenuItem
                icon={<IconCpu size={15} />}
                hint="Testa a chave e o modelo configurados"
                onClick={handleCheckAiModel}
                disabled={checkingAi}
              >
                {checkingAi ? 'Verificando…' : 'Verificar modelo de IA'}
              </MenuItem>
            </Menu>
            <button type="button" className="btn btn-dark" onClick={handleExportCSV} disabled={exporting}>
              {exporting ? <Spinner /> : <IconDownload size={15} />}
              Exportar CSV{total > 0 ? ` (${total})` : ''}
            </button>
          </>
        )}
      />

      {bulkProgress && (
        <div className="alert alert-info" role="status">
          <Spinner />
          <span>
            <strong>Reprocessando {bulkProgress.done} de {bulkProgress.total} posts…</strong>{' '}
            Mantenha esta aba aberta até terminar.
          </span>
        </div>
      )}

      <div className="filter-bar">
        <label className="filter-field filter-field-wide">
          <span>Influenciador</span>
          <select className="form-control form-control-sm" value={influencerFilter} onChange={(e) => withPageReset(setInfluencerFilter)(e.target.value)}>
            <option value="">Todos</option>
            {influencers.map((inf) => (
              <option key={inf.id} value={inf.id}>{inf.display_name || inf.username}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Mês</span>
          <select className="form-control form-control-sm" value={monthFilter} onChange={(e) => withPageReset(setMonthFilter)(e.target.value)}>
            <option value="">Todos</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Ano</span>
          <select className="form-control form-control-sm" value={yearFilter} onChange={(e) => withPageReset(setYearFilter)(e.target.value)}>
            <option value="">Todos</option>
            {yearOptions().map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Plataforma</span>
          <select className="form-control form-control-sm" value={platformFilter} onChange={(e) => withPageReset(setPlatformFilter)(e.target.value)}>
            <option value="">Todas</option>
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Formato</span>
          <select className="form-control form-control-sm" value={formatFilter} onChange={(e) => withPageReset(setFormatFilter)(e.target.value)}>
            <option value="">Todos</option>
            <option value="feed">Feed</option>
            <option value="story">Story</option>
          </select>
        </label>
        <label className="filter-field">
          <span>De</span>
          <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => withPageReset(setDateFrom)(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>Até</span>
          <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => withPageReset(setDateTo)(e.target.value)} />
        </label>
        <label className="filter-field filter-field-wide">
          <span>Ordenar por</span>
          <select className="form-control form-control-sm" value={sortBy} onChange={(e) => withPageReset(setSortBy)(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {activeChips.length > 0 && (
        <div className="chips">
          {activeChips.map((chip) => (
            <span key={chip.key} className="chip">
              {chip.label}
              <button type="button" onClick={chip.clear} aria-label={`Remover filtro ${chip.label}`}><IconX size={12} /></button>
            </span>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>Limpar filtros</button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Skeleton height={420} />
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Influenciador</th>
                  <th className="hide-sm">Plataforma</th>
                  <th>Formato</th>
                  <th className="hide-sm">Data</th>
                  <th className="num">Visualizações</th>
                  <th className="num">Curtidas</th>
                  <th className="num"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <EmptyState
                        icon={<IconImage size={20} />}
                        title="Nenhum post encontrado"
                        text="Tente ajustar ou limpar os filtros acima."
                        action={activeChips.length > 0 && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>Limpar filtros</button>
                        )}
                      />
                    </td>
                  </tr>
                ) : posts.map((post) => (
                  <tr key={post.id} className="clickable" onClick={() => setExpandedPost(post)}>
                    <td>
                      <div className="post-cell">
                        <PostThumb src={post.image_url} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span className="cell-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {post.title || 'Sem título'}
                            <PostLink url={post.post_url} />
                          </span>
                          {post.possible_duplicate && <span><DuplicateBadge /></span>}
                        </div>
                      </div>
                    </td>
                    <td className="nowrap">{post.influencer_name || post.display_name || '—'}</td>
                    <td className="hide-sm"><PlatformLabel platform={post.platform} /></td>
                    <td><FormatBadge type={post.post_type} /></td>
                    <td className="hide-sm muted nowrap">{formatDate(post.published_date || post.created_at)}</td>
                    <td className="num strong"><MetricCell value={post.impressions} format={formatCompact} /></td>
                    <td className="num"><MetricCell value={post.likes} format={formatCompact} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="cell-actions">
                        <button type="button" className="btn btn-icon" onClick={() => setExpandedPost(post)} title="Ver prints e métricas" aria-label="Ver prints e métricas">
                          <IconEye size={15} />
                        </button>
                        <button type="button" className="btn btn-icon" onClick={() => setEditPost(post)} title="Editar" aria-label="Editar">
                          <IconPencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => handleReprocess(post)}
                          disabled={reprocessingId === post.id || !!bulkProgress}
                          title="Re-extrair métricas com IA"
                          aria-label="Re-extrair métricas com IA"
                        >
                          {reprocessingId === post.id ? <Spinner size={14} /> : <IconRefresh size={15} />}
                        </button>
                        <button type="button" className="btn btn-icon danger" onClick={() => handleDelete(post)} title="Excluir" aria-label="Excluir">
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="pagination">
              <span className="pagination-info">
                Mostrando <strong>{firstRow}–{lastRow}</strong> de <strong>{total}</strong> posts
              </span>
              {totalPages > 1 && (
                <div className="pagination-pages">
                  <button type="button" className="page-btn" disabled={page === 1} onClick={() => setPage(1)} aria-label="Primeira página">«</button>
                  <button type="button" className="page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">‹</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        type="button"
                        key={p}
                        className={`page-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                        aria-current={page === p ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button type="button" className="page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">›</button>
                  <button type="button" className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)} aria-label="Última página">»</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {expandedPost && (
        <PostDetailModal
          post={expandedPost}
          onClose={() => setExpandedPost(null)}
          actions={(
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setEditPost(expandedPost); setExpandedPost(null); }}
            >
              <IconPencil size={14} /> Editar
            </button>
          )}
        />
      )}
      {editPost && (
        <EditPostModal
          post={editPost}
          endpoint={`/admin/posts/${editPost.id}`}
          onSaved={handleEditSaved}
          onClose={() => setEditPost(null)}
        />
      )}
    </>
  );
}
