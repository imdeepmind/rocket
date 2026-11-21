import React from 'react';

import styles from './styles.module.css';

export type IconBadgeVariant =
  'primary' | 'success' | 'warning' | 'error' | 'surface' | 'muted';
export type IconBadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconBadgeRounded = 'sm' | 'md' | 'lg' | 'full';

export interface IconBadgeProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'className'
> {
  icon?: React.ReactNode;
  variant?: IconBadgeVariant;
  size?: IconBadgeSize;
  rounded?: IconBadgeRounded;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function IconBadge({
  icon,
  variant = 'primary',
  size = 'md',
  rounded = 'md',
  classNameOverride,
  children,
  ...props
}: IconBadgeProps): React.JSX.Element {
  const defaultClasses = [
    styles.iconBadge,
    styles[variant],
    styles[size],
    styles[`rounded-${rounded}`],
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <span className={combinedClass} aria-hidden="true" {...props}>
      {children ?? icon}
    </span>
  );
}
