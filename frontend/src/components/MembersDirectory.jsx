import React, { useState, useEffect } from 'react';
import api from '../api.js';
import styles from './MembersDirectory.module.css';

// View-only directory of active influencers (name, bio, photo).
// No interaction between profiles — visualization only.
export default function MembersDirectory() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/members')
      .then((res) => { if (mounted) setMembers(res.data?.members || []); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="skeleton" style={{ height: 140, borderRadius: 8, marginBottom: 8 }} />;
  }

  if (members.length === 0) return null;

  return (
    <div className={styles.grid}>
      {members.map((m) => {
        const initial = (m.display_name || m.username || 'U')[0]?.toUpperCase();
        return (
          <div key={m.id} className={styles.card}>
            {m.avatar_url ? (
              <img src={m.avatar_url} alt={m.display_name} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>{initial}</div>
            )}
            <div className={styles.name}>{m.display_name || m.username}</div>
            {m.bio && <div className={styles.bio}>{m.bio}</div>}
          </div>
        );
      })}
    </div>
  );
}
