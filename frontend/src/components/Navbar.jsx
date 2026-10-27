import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconGrid, IconUpload, IconTicket, IconUser, IconList, IconUsers, IconMail,
  IconCamera, IconKey, IconHome, IconMenu, IconX, IconLogOut, IconChevronUp,
  IconBarChart,
} from './Icons.jsx';
import { Avatar } from './ui.jsx';
import styles from './Navbar.module.css';

// Navigation is grouped by job-to-be-done so each role sees a short,
// predictable menu. `cta` renders the item as the sidebar's primary button.
const influencerNav = [
  {
    items: [
      { to: '/upload', label: 'Enviar posts', icon: <IconUpload size={16} />, cta: true },
      { to: '/dashboard', label: 'Início', icon: <IconHome size={16} /> },
      { to: '/coupons', label: 'Meus cupons', icon: <IconTicket size={16} /> },
      { to: '/profile', label: 'Meu perfil', icon: <IconUser size={16} /> },
    ],
  },
];

const adminNav = [
  {
    title: 'Desempenho',
    items: [
      { to: '/admin', label: 'Visão geral', icon: <IconGrid size={16} />, end: true },
      { to: '/admin/posts', label: 'Posts', icon: <IconList size={16} /> },
      { to: '/admin/reports', label: 'Relatório mensal', icon: <IconMail size={16} /> },
    ],
  },
  {
    title: 'Influenciadores',
    items: [
      { to: '/admin/freelancers', label: 'Avulsos', icon: <IconCamera size={16} /> },
    ],
  },
  {
    title: 'Cupons',
    items: [
      { to: '/admin/coupon-partners', label: 'Registro de cupons', icon: <IconKey size={16} /> },
      { to: '/coupons', label: 'Contagem mensal', icon: <IconTicket size={16} /> },
    ],
  },
  {
    // Admins também têm o fluxo do influenciador (Dashboard pessoal + envio de
    // posts/métricas) para testar o processo completo ponta a ponta.
    title: 'Minha área',
    items: [
      { to: '/dashboard', label: 'Meu dashboard', icon: <IconBarChart size={16} /> },
      { to: '/upload', label: 'Enviar posts', icon: <IconUpload size={16} /> },
    ],
  },
  {
    title: 'Administração',
    items: [
      { to: '/admin/users', label: 'Usuários', icon: <IconUsers size={16} /> },
    ],
  },
];

// "Operação": papel restrito, enxerga apenas a aba Registro de Cupons no
// menu principal (o link "Perfil" continua disponível no menu do avatar).
const operacaoNav = [
  {
    items: [
      { to: '/admin/coupon-partners', label: 'Registro de cupons', icon: <IconKey size={16} />, end: true },
    ],
  },
];

const ROLE_LABEL = { admin: 'Administrador', operacao: 'Operação', influencer: 'Influenciador' };

function homeFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'operacao') return '/admin/coupon-partners';
  return '/dashboard';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the mobile drawer and the account menu on every navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const groups = user?.role === 'admin'
    ? adminNav
    : user?.role === 'operacao'
      ? operacaoNav
      : influencerNav;

  const name = user?.display_name || user?.username;

  return (
    <>
      {/* Mobile top bar */}
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
        >
          <IconMenu size={20} />
        </button>
        <Link to={homeFor(user?.role)} className={styles.topbarLogo} aria-label="Início">
          <img src="/images/logo-nex-preto.png" alt="Nex" />
        </Link>
        <Link to="/profile" className={styles.topbarAvatar} aria-label="Meu perfil">
          <Avatar src={user?.avatar_url} name={name} size={30} variant="accent" />
        </Link>
      </header>

      {drawerOpen && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <nav className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`} aria-label="Menu principal">
        <div className={styles.logo}>
          <Link to={homeFor(user?.role)} className={styles.logoLink}>
            <img src="/images/logo-nex-preto.png" alt="Nex" className={styles.logoImg} />
            <span className={styles.logoSub}>Influencer Metrics</span>
          </Link>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className={styles.navScroll}>
          {groups.map((group, gi) => (
            <div key={group.title || gi} className={styles.group}>
              {group.title && <p className={styles.groupTitle}>{group.title}</p>}
              <ul className={styles.navList}>
                {group.items.map((link) => (
                  <li key={`${group.title}-${link.to}`}>
                    <NavLink
                      to={link.to}
                      end={link.end}
                      className={({ isActive }) => [
                        link.cta ? styles.navCta : styles.navLink,
                        isActive ? (link.cta ? styles.navCtaActive : styles.navLinkActive) : '',
                      ].join(' ')}
                    >
                      <span className={styles.navIcon}>{link.icon}</span>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottomSection} ref={menuRef}>
          {menuOpen && (
            <div className={styles.avatarMenu} role="menu">
              <NavLink to="/profile" className={styles.avatarMenuItem} role="menuitem">
                <IconUser size={15} />
                Meu perfil
              </NavLink>
              <hr className={styles.avatarMenuDivider} />
              <button
                type="button"
                role="menuitem"
                className={`${styles.avatarMenuItem} ${styles.avatarMenuLogout}`}
                onClick={handleLogout}
              >
                <IconLogOut size={15} />
                Sair
              </button>
            </div>
          )}

          <button
            type="button"
            className={styles.userTrigger}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Avatar src={user?.avatar_url} name={name} size={34} variant="accent" />
            <span className={styles.userDetails}>
              <span className={styles.userName}>{name}</span>
              <span className={styles.userRole}>{ROLE_LABEL[user?.role] || 'Influenciador'}</span>
            </span>
            <span className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`}>
              <IconChevronUp size={14} />
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
