import React from 'react';

import styles from './styles.module.css';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'success' | 'warning' | 'accent';
  showLabel?: boolean;
  classNameOverride?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'primary',
  showLabel = false,
  classNameOverride,
  ...props
}: ProgressBarProps): React.JSX.Element {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const trackClasses = [styles.track, styles[size]].filter(Boolean).join(' ');

  const fillClasses = [styles.fill, styles[variant]].filter(Boolean).join(' ');

  const combinedClass = classNameOverride ?? styles.container;

  return (
    <div
      className={combinedClass}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <div className={trackClasses}>
        <div className={fillClasses} style={{width: `${percentage}%`}} />
      </div>
      {showLabel && (
        <span className={styles.label}>{Math.round(percentage)}%</span>
      )}
    </div>
  );
}
