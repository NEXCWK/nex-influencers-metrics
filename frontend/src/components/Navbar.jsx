import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconGrid, IconUpload, IconTicket, IconUser,
  IconList, IconUsers,
} from './Icons.jsx';
import styles from './Navbar.module.css';

const influencerLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconGrid size={15} /> },
  { to: '/upload', label: 'Novo Post', icon: <IconUpload size={15} /> },
  { to: '/coupons', label: 'Cupons', icon: <IconTicket size={15} /> },
  { to: '/profile', label: 'Atualizar Perfil', icon: <IconUser size={15} /> },
];

const adminLinks = [
  { to: '/admin', label: 'Visao Geral', icon: <IconGrid size={15} />, end: true },
  { to: '/admin/posts', label: 'Todos os Posts', icon: <IconList size={15} /> },
  { to: '/admin/users', label: 'Usuarios', icon: <IconUsers size={15} /> },
  { to: '/coupons', label: 'Cupons', icon: <IconTicket size={15} /> },
  { to: '/profile', label: 'Atualizar Perfil', icon: <IconUser size={15} /> },
];

function IconChevronUp({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const links = user?.role === 'admin' ? adminLinks : influencerLinks;

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/images/logo-nex-preto.png" alt="Nex" className={styles.logoImg} />
        <span className={styles.logoSub}>Influencer Metrics</span>
      </div>

      <ul className={styles.navList}>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{link.icon}</span>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className={styles.bottomSection} ref={menuRef}>
        {menuOpen && (
          <div className={styles.avatarMenu}>
            <NavLink
              to="/profile"
              className={styles.avatarMenuItem}
              onClick={() => setMenuOpen(false)}
            >
              <IconUser size={14} />
              Perfil
            </NavLink>
            <hr className={styles.avatarMenuDivider} />
            <button className={`${styles.avatarMenuItem} ${styles.avatarMenuLogout}`} onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sair
            </button>
          </div>
        )}

        <button
          className={styles.userTrigger}
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className={styles.userAvatarImg} />
          ) : (
            <div className={styles.userAvatar}>
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </div>
          )}
          <div className={styles.userDetails}>
            <span className={styles.userName}>
              {user?.display_name || user?.username}
            </span>
            <span className={styles.userRole}>
              {user?.role === 'admin' ? 'Administrador' : 'Influenciador'}
            </span>
          </div>
          <span className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`}>
            <IconChevronUp />
          </span>
        </button>
      </div>
    </nav>
  );
}
