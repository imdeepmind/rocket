'use client';

import React, {forwardRef, useId} from 'react';

import Typography from '@/components/bits/Typography';

import styles from './styles.module.css';

export interface TextBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  hint?: string;
  error?: string;
  sizeVariant?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  classNameOverride?: string;
}

export const TextBox = forwardRef<HTMLInputElement, TextBoxProps>(
  function TextBox(
    {
      label,
      labelRight,
      hint,
      error,
      sizeVariant = 'md',
      leftIcon,
      rightIcon,
      fullWidth = false,
      classNameOverride,
      id: customId,
      disabled,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const id = customId || generatedId;

    const containerClasses = [
      styles.container,
      fullWidth ? styles.fullWidth : '',
      disabled ? styles.disabled : '',
      error ? styles.hasError : '',
    ]
      .filter(Boolean)
      .join(' ');

    const wrapperClasses = [
      styles.inputWrapper,
      styles[sizeVariant],
      error ? styles.inputError : '',
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = classNameOverride ?? styles.input;

    return (
      <div className={containerClasses}>
        {(label || labelRight) && (
          <div className={styles.labelRow}>
            {label && (
              <label htmlFor={id} className={styles.label}>
                {label}
              </label>
            )}
            {labelRight && (
              <div className={styles.labelRight}>{labelRight}</div>
            )}
          </div>
        )}

        <div className={wrapperClasses}>
          {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            className={inputClasses}
            {...rest}
          />
          {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
        </div>

        {error && (
          <Typography
            variant="caption"
            color="error"
            classNameOverride={styles.feedbackText}
          >
            {error}
          </Typography>
        )}
        {!error && hint && (
          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.feedbackText}
          >
            {hint}
          </Typography>
        )}
      </div>
    );
  },
);

TextBox.displayName = 'TextBox';
export default TextBox;
