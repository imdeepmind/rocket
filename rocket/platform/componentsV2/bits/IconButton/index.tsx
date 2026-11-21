'use client';

import React, {forwardRef} from 'react';

import styles from './styles.module.css';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  classNameOverride?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      tooltip,
      classNameOverride,
      disabled,
      ...props
    },
    ref,
  ) {
    const defaultClasses = [
      styles.iconButton,
      styles[variant],
      styles[size],
      disabled ? styles.disabled : '',
    ]
      .filter(Boolean)
      .join(' ');

    const combinedClass = classNameOverride ?? defaultClasses;

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        title={tooltip || ariaLabel}
        disabled={disabled}
        className={combinedClass}
        {...props}
      >
        <span className={styles.icon}>{icon}</span>
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
export default IconButton;
