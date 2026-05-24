import React from 'react';
import styles from './PostList.module.css';

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

function PlatformBadge({ platform }) {
  const label = PLATFORM_LABELS[platform] || platform;
  return (
    <span className={`${styles.platformBadge} platform-${platform}`}>
      {label}
    </span>
  );
}

function formatNum(value) {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace('.', ',')}K`;
  return num.toLocaleString('pt-BR');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

export default function PostList({ posts = [], onPostClick }) {
  if (!posts.length) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 16px',
        color: '#888',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        Nenhum post encontrado para o período selecionado.
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Post</th>
            <th>Plataforma</th>
            <th>Data</th>
            <th>Alcance</th>
            <th>Curtidas</th>
            <th>Engajamento</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className={onPostClick ? styles.clickableRow : ''}
              onClick={onPostClick ? () => onPostClick(post) : undefined}
            >
              <td>
                <div className={styles.postCell}>
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt={post.title || 'Post'}
                      className={styles.thumbnail}
                    />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      <span>📷</span>
                    </div>
                  )}
                  <span className={styles.postTitle}>
                    {post.title || 'Post sem título'}
                  </span>
                </div>
              </td>
              <td>
                <PlatformBadge platform={post.platform} />
              </td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {formatDate(post.published_date || post.created_at)}
              </td>
              <td>{formatNum(post.reach)}</td>
              <td>{formatNum(post.likes)}</td>
              <td>
                {post.engagement_rate !== null && post.engagement_rate !== undefined
                  ? `${parseFloat(post.engagement_rate).toFixed(2)}%`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
