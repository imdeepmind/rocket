import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './styles.module.css';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps): React.JSX.Element {
  return (
    <div className={styles.wrapper}>
      {/* Ambient background glow */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      <div className={styles.container}>
        {/* Brand header */}
        <Link href="/" className={styles.brandHeader} aria-label="Rocket Home">
          <Image
            src="/logo.png"
            alt="Rocket Logo"
            width={32}
            height={32}
            style={{
              objectFit: 'contain',
              display: 'block',
              borderRadius: '8px',
            }}
          />
          <span className={styles.brandName}>Rocket</span>
        </Link>

        {/* Auth card */}
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          {children}
        </div>

        {/* Footer outside card */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

