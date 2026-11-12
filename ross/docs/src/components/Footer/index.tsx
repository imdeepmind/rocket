import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export default function Footer(): React.JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.w} ${styles.footerInner}`}>
        <span>© 2026 ROSS. Open source.</span>
        <nav className={styles.footerLinks}>
          <Link to="/docs">Documentation</Link>
          <a
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://github.com/imdeepmind/rocket/discussions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Community
          </a>
          <a
            href="https://github.com/imdeepmind/rocket/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            License
          </a>
        </nav>
      </div>
    </footer>
  );
}

