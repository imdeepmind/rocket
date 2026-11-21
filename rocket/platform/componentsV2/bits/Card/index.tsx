import React from 'react';

import styles from './styles.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  classNameOverride,
  children,
  ...props
}: CardProps): React.JSX.Element {
  const defaultClasses = [
    styles.card,
    styles[variant],
    styles[`pad-${padding}`],
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? defaultClasses;

  return (
    <div className={combinedClass} {...props}>
      {children}
    </div>
  );
}
