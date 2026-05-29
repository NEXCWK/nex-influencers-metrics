import React from 'react';
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
  { to: '/admin', label: 'Visão Geral', icon: <IconGrid size={15} />, end: true },
  { to: '/admin/posts', label: 'Todos os Posts', icon: <IconList size={15} /> },
  { to: '/admin/users', label: 'Usuários', icon: <IconUsers size={15} /> },
  { to: '/coupons', label: 'Cupons', icon: <IconTicket size={15} /> },
  { to: '/profile', label: 'Atualizar Perfil', icon: <IconUser size={15} /> },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = user?.role === 'admin' ? adminLinks : influencerLinks;

  return (
    <nav className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <img src="/images/logo-nex-preto.png" alt="Nex" className={styles.logoImg} />
        <span className={styles.logoSub}>Influencer Metrics</span>
      </div>

      {/* Navigation Links */}
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

      {/* Bottom: user info + logout */}
      <div className={styles.bottomSection}>
        <div className={styles.userInfo}>
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
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>
    </nav>
  );
}
