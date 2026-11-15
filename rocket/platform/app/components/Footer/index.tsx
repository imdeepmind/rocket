import React from 'react';
import styles from './styles.module.css';

export default function Footer(): React.JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.w} ${styles.footerInner}`}>
        <span>© 2026 Rocket</span>
        <nav className={styles.footerLinks}>
          <a href="#features">Product</a>
          <a href="#docs">Documentation</a>
          <a href="#pricing">Pricing</a>
          <a
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a href="#">Sign in</a>
        </nav>
      </div>
    </footer>
  );
}

