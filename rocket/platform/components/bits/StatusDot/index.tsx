import React from 'react';

import styles from './styles.module.css';

export type StatusDotVariant =
  'success' | 'warning' | 'error' | 'waiting' | 'loading' | 'spinner' | 'info';
export type StatusDotSize = 'sm' | 'md' | 'lg';

export interface StatusDotProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'className'
> {
  variant?: StatusDotVariant;
  size?: StatusDotSize;
  pulse?: boolean;
  classNameOverride?: string;
}

export default function StatusDot({
  variant = 'success',
  size = 'md',
  pulse = false,
  classNameOverride,
  ...props
}: StatusDotProps): React.JSX.Element {
  const defaultClasses = [
    styles.statusDot,
    styles[variant],
    styles[size],
    pulse ? styles.pulse : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return <span className={combinedClass} aria-hidden="true" {...props} />;
}
