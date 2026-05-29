import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Navbar.module.css';

const influencerLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈' },
  { to: '/upload', label: 'Novo Post', icon: '↑' },
  { to: '/coupons', label: 'Cupons', icon: '🎟️' },
  { to: '/profile', label: 'Atualizar Perfil', icon: '◐' },
];

const adminLinks = [
  { to: '/admin', label: 'Visão Geral', icon: '◈', end: true },
  { to: '/admin/posts', label: 'Todos os Posts', icon: '▤' },
  { to: '/admin/users', label: 'Usuários', icon: '◉' },
  { to: '/coupons', label: 'Cupons', icon: '🎟️' },
  { to: '/profile', label: 'Atualizar Perfil', icon: '◐' },
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
          <span>⏻</span> Sair
        </button>
      </div>
    </nav>
  );
}
