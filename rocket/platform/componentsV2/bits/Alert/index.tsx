'use client';

import React from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';

import IconButton from '@/componentsV2/bits/IconButton';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function Alert({
  variant = 'info',
  title,
  message,
  icon,
  dismissible = false,
  onDismiss,
  classNameOverride,
  children,
  ...props
}: AlertProps): React.JSX.Element {
  const defaultClasses = [styles.alert, styles[variant]]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? defaultClasses;

  return (
    <div className={combinedClass} role="alert" {...props}>
      <div className={styles.iconContainer}>
        {icon ??
          (variant === 'success' ? (
            <CheckIcon width={16} height={16} />
          ) : (
            <span className={styles.defaultDot} aria-hidden="true" />
          ))}
      </div>

      <div className={styles.content}>
        {title && (
          <Typography
            variant="body-sm"
            weight="semibold"
            classNameOverride={styles.title}
          >
            {title}
          </Typography>
        )}
        <div className={styles.message}>{message ?? children}</div>
      </div>

      {dismissible && onDismiss && (
        <IconButton
          icon={<CloseIcon width={14} height={14} />}
          aria-label="Dismiss alert"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          classNameOverride={styles.dismissBtn}
        />
      )}
    </div>
  );
}
