import React from 'react';

import styles from './styles.module.css';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: 'currentColor' | 'success';
  dotPulse?: boolean;
  label?: React.ReactNode;
  children?: React.ReactNode;
  classNameOverride?: string;
}

export default function Tag({
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor = 'currentColor',
  dotPulse = false,
  label,
  children,
  classNameOverride,
  ...props
}: TagProps): React.JSX.Element {
  const content = children ?? label;
  const showDot =
    dot ||
    variant === 'success' ||
    variant === 'warning' ||
    variant === 'error';

  const dotClasses = [
    styles.dot,
    dotColor === 'success' ? styles.dotSuccess : '',
    dotPulse ? styles.dotPulse : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? classNameOverride
    : [styles.tag, styles[variant], styles[size]].filter(Boolean).join(' ');

  return (
    <span className={combinedClass} {...props}>
      {showDot && <span className={dotClasses} aria-hidden="true" />}
      {content}
    </span>
  );
}
