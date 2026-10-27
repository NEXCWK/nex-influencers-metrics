import React from 'react';
import { FormatBadge, MetricCell, PostLink, PlatformLabel, PostThumb } from './PostBadges.jsx';
import { EmptyState } from './ui.jsx';
import { IconImage, IconPencil } from './Icons.jsx';
import { formatCompact, formatDate } from '../utils/format.js';

export default function PostList({ posts = [], onPostClick, onEdit, emptyAction }) {
  if (!posts.length) {
    return (
      <EmptyState
        bordered
        icon={<IconImage size={20} />}
        title="Nenhum post neste período"
        text="Os posts enviados aparecem aqui com as métricas extraídas dos prints."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Post</th>
            <th className="hide-sm">Plataforma</th>
            <th>Formato</th>
            <th className="hide-sm">Data</th>
            <th className="num">Visualizações</th>
            <th className="num">Curtidas</th>
            {onEdit && <th className="num"><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className={onPostClick ? 'clickable' : ''}
              onClick={onPostClick ? () => onPostClick(post) : undefined}
            >
              <td>
                <div className="post-cell">
                  <PostThumb src={post.image_url} />
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {post.title || 'Post sem título'}
                      <PostLink url={post.post_url} />
                    </div>
                  </div>
                </div>
              </td>
              <td className="hide-sm"><PlatformLabel platform={post.platform} /></td>
              <td><FormatBadge type={post.post_type} /></td>
              <td className="hide-sm muted nowrap">{formatDate(post.published_date || post.created_at)}</td>
              <td className="num strong"><MetricCell value={post.impressions} format={formatCompact} /></td>
              <td className="num"><MetricCell value={post.likes} format={formatCompact} /></td>
              {onEdit && (
                <td className="num">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); onEdit(post); }}
                  >
                    <IconPencil size={13} /> Editar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
