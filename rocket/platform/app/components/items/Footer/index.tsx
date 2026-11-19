import React from 'react';
import Link from 'next/link';
import Text from '@/app/components/bits/Text';
import styles from './styles.module.css';

export default function Footer(): React.JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.w} ${styles.footerInner}`}>
        <Text
          as="span"
          variant="caption"
          color="muted"
          className={styles.copyright}
        >
          Copyright © 2026 Abhishek Chatterjee
        </Text>
        <nav className={styles.footerLinks}>
          <Link href="/">Home</Link>
          <a
            href="https://ross.imdeepmind.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            ROSS
          </a>
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Pricing</Link>
          <a
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <Link href="/auth/sign-in">Sign In</Link>
        </nav>
      </div>
    </footer>
  );
}
