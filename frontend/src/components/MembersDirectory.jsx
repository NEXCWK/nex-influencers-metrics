import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { Avatar } from './ui.jsx';
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
    return <div className="skeleton" style={{ height: 120 }} />;
  }

  if (members.length === 0) return null;

  return (
    <div className={styles.grid}>
      {members.map((m) => (
        <div key={m.id} className={styles.card}>
          <Avatar src={m.avatar_url} name={m.display_name || m.username} size={44} />
          <div className={styles.text}>
            <div className={styles.name}>{m.display_name || m.username}</div>
            {m.bio ? <div className={styles.bio}>{m.bio}</div> : <div className={styles.handle}>@{m.username}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
