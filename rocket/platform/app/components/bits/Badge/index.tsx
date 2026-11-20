import React from 'react';

import styles from './styles.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'active' | 'deploying' | 'paused' | 'count' | 'keycap';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
  ...props
}: BadgeProps): React.JSX.Element {
  const showDot =
    dot ||
    variant === 'active' ||
    variant === 'deploying' ||
    variant === 'paused';

  return (
    <span
      className={[styles.badge, styles[variant], styles[size], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
