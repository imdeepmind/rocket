import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import Card from '@/componentsV2/bits/Card';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  classNameOverride?: string;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  classNameOverride,
}: AuthShellProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.wrapper;

  return (
    <div className={combinedClass}>
      <div className={styles.container}>
        {/* Brand header */}
        <Link href="/" className={styles.brandHeader} aria-label="Rocket Home">
          <Image
            src="/logo.png"
            alt="Rocket Logo"
            width={32}
            height={32}
            className={styles.brandLogo}
          />
          <Typography variant="body" weight="bold" color="white" as="span">
            Rocket
          </Typography>
        </Link>

        {/* Auth card */}
        <Card padding="lg" variant="default" className={styles.card}>
          <div className={styles.header}>
            <Typography variant="h2" as="h1" classNameOverride={styles.title}>
              {title}
            </Typography>
            <Typography variant="body-sm" color="muted">
              {subtitle}
            </Typography>
          </div>

          <div className={styles.body}>{children}</div>
        </Card>

        {/* Footer outside card */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
