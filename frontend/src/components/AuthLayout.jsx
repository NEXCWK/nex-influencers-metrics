import React from 'react';
import styles from './AuthLayout.module.css';

// Split-screen shell for the public screens (login, first-access password):
// brand panel on the left, form on the right. The brand panel hides on
// small screens so the form is the first thing on a phone.
export default function AuthLayout({ children, dark = false, topRight }) {
  return (
    <div className={styles.page} data-dark={dark ? 'true' : undefined}>
      <aside className={styles.brand} aria-hidden="true">
        <img src="/images/logo-nex-branco.png" alt="" className={styles.brandLogo} />
        <div>
          <p className={styles.brandEyebrow}>Influencer Metrics</p>
          <p className={styles.brandTitle}>
            As métricas dos influenciadores <span>Nex</span>, num só lugar.
          </p>
          <p className={styles.brandText}>
            Envie os prints, a IA lê os números e o desempenho de cada post fica organizado mês a mês.
          </p>
        </div>
        <p className={styles.brandFooter}>Nex Coworking &copy; {new Date().getFullYear()} · Uso restrito</p>
      </aside>

      <main className={styles.formSide}>
        {topRight && <div className={styles.topRight}>{topRight}</div>}
        <div className={styles.formWrap}>
          {children}
        </div>
      </main>
    </div>
  );
}

export { styles as authStyles };
