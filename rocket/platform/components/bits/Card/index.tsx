import React from 'react';

import styles from './styles.module.css';

export interface CardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'className'
> {
  variant?:
    | 'default'
    | 'glass'
    | 'interactive'
    | 'bordered'
    | 'subtle'
    | 'danger'
    | 'success'
    | 'floating';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'row' | 'floating';
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  fullWidth?: boolean;
  hoverable?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  radius,
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
    radius ? styles[`radius-${radius}`] : '',
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
