import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { IconX, IconMore, IconChevronRight } from './Icons.jsx';
import { MONTHS, yearOptions } from '../utils/format.js';

// ---------------------------------------------------------------------------
// Small presentational building blocks shared by every page, so headers,
// tabs, empty states and modals look and behave the same everywhere.
// ---------------------------------------------------------------------------

/**
 * Page title block. `crumbs` = [{ label, to? }] renders a breadcrumb above
 * the title; `actions` sits on the right (wraps below on small screens).
 */
export function PageHeader({ title, subtitle, crumbs, actions, children }) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {crumbs && crumbs.length > 0 && (
          <nav className="page-eyebrow" aria-label="Navegação estrutural">
            {crumbs.map((c, i) => (
              <React.Fragment key={c.label}>
                {i > 0 && <IconChevronRight size={12} />}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, hint, actions }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {hint && <p className="section-hint">{hint}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Pill-style view switcher. options = [{ value, label, count? }] */
export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented-btn ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
          {o.count != null && <span className="segmented-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Underlined page sub-navigation. tabs = [{ value, label, icon?, count? }] */
export function Tabs({ tabs, value, onChange, ariaLabel }) {
  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`tab-btn ${value === t.value ? 'active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.icon}
          {t.label}
          {t.count != null && <span className="badge badge-neutral">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action, bordered = false }) {
  return (
    <div className={`empty-state ${bordered ? 'card-empty' : ''}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <p className="empty-state-title">{title}</p>}
      {text && <p className="empty-state-text">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 120, style }) {
  return <div className="skeleton" style={{ height, ...style }} aria-hidden="true" />;
}

/**
 * Accessible modal: closes on Escape and on backdrop click, locks body
 * scroll while open. `footer` renders in a sticky action bar.
 */
export function Modal({ title, subtitle, onClose, children, footer, maxWidth = 560, eyebrow }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Portal to <body> so no transformed/overflowing ancestor can trap or
  // clip the fixed overlay.
  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={cardRef}
        className="modal-card"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Dropdown action menu. `trigger` is rendered inside a button; items are
 * passed as children (use <MenuItem>). Rendered in a portal with fixed
 * positioning so it is never clipped by scrollable tables; opens upward when
 * there's no room below. Closes on outside click, Escape, scroll or resize.
 */
export function Menu({ trigger, label = 'Mais ações', children, buttonClassName = 'btn btn-secondary', align = 'right' }) {
  const [pos, setPos] = useState(null); // null = closed
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = () => setPos(null);

  const toggle = () => {
    if (pos) { close(); return; }
    const r = btnRef.current.getBoundingClientRect();
    const openUp = window.innerHeight - r.bottom < 260 && r.top > 260;
    setPos({
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      ...(align === 'left' ? { left: r.left } : { right: Math.max(8, window.innerWidth - r.right) }),
    });
  };

  useEffect(() => {
    if (!pos) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);

  return (
    <div className="menu-wrap">
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        onClick={toggle}
      >
        {trigger || <IconMore size={16} />}
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          style={{ position: 'fixed', ...pos }}
          onClick={close}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function MenuItem({ icon, children, hint, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="menu-item-text">
        <span>{children}</span>
        {hint && <span className="menu-item-hint">{hint}</span>}
      </span>
    </button>
  );
}

export function MonthSelect({ value, onChange, className = 'form-control', allLabel, ...props }) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      aria-label="Mês"
      {...props}
    >
      {allLabel && <option value="">{allLabel}</option>}
      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );
}

export function YearSelect({ value, onChange, className = 'form-control', allLabel, ...props }) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      aria-label="Ano"
      {...props}
    >
      {allLabel && <option value="">{allLabel}</option>}
      {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

export function Avatar({ src, name, size = 32, variant }) {
  const initial = ((name || 'U').trim()[0] || 'U').toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (src) return <img src={src} alt="" className="avatar" style={style} />;
  return (
    <span className={`avatar ${variant ? `avatar-${variant}` : ''}`} style={style} aria-hidden="true">
      {initial}
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size, borderWidth: 2 }} aria-hidden="true" />;
}
