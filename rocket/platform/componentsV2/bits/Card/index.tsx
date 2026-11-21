import React from 'react';

import styles from './styles.module.css';

export interface CardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'className'
> {
  variant?:
    'default' | 'glass' | 'interactive' | 'bordered' | 'subtle' | 'danger';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  hoverable?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  fullWidth = false,
  hoverable = false,
  classNameOverride,
  children,
  ...props
}: CardProps): React.JSX.Element {
  const defaultClasses = [
    styles.card,
    styles[variant],
    styles[`pad-${padding}`],
    fullWidth ? styles.fullWidth : '',
    hoverable ? styles.hoverable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <div className={combinedClass} {...props}>
      {children}
    </div>
  );
}
