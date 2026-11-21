import Link from 'next/link';
import React from 'react';

import Typography from '@/components/bits/Typography';

import styles from './styles.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  classNameOverride?: string;
}

export default function Breadcrumb({
  items,
  separator = '/',
  classNameOverride,
  ...props
}: BreadcrumbProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.breadcrumb;

  return (
    <nav className={combinedClass} aria-label="Breadcrumb" {...props}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isActive = item.active || isLast;

          return (
            <li key={item.label} className={styles.item}>
              {index > 0 && (
                <span className={styles.separator} aria-hidden="true">
                  {separator}
                </span>
              )}
              {item.href && !isActive ? (
                <Link href={item.href} className={styles.link}>
                  <Typography variant="body-sm" color="muted">
                    {item.label}
                  </Typography>
                </Link>
              ) : (
                <Typography
                  variant="body-sm"
                  color={isActive ? 'white' : 'muted'}
                  weight={isActive ? 'semibold' : 'normal'}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Typography>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
