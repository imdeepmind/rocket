'use client';

import React, { forwardRef, useId } from 'react';
import styles from './styles.module.css';

export interface TextBoxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

export const TextBox = forwardRef<HTMLInputElement, TextBoxProps>(
  function TextBox(
    {
      label,
      labelRight,
      error,
      hint,
      leftIcon,
      rightIcon,
      fullWidth = false,
      sizeVariant = 'md',
      id: customId,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) {
    const generatedId = useId();
    const id = customId || generatedId;

    return (
      <div
        className={[
          styles.container,
          fullWidth ? styles.fullWidth : '',
          disabled ? styles.disabled : '',
          error ? styles.hasError : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {(label || labelRight) && (
          <div className={styles.labelRow}>
            {label && (
              <label htmlFor={id} className={styles.label}>
                {label}
              </label>
            )}
            {labelRight && <div className={styles.labelRight}>{labelRight}</div>}
          </div>
        )}

        <div
          className={[
            styles.inputWrapper,
            styles[sizeVariant],
            error ? styles.inputError : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            className={[styles.input, className].filter(Boolean).join(' ')}
            {...rest}
          />
          {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {!error && hint && <p className={styles.hintText}>{hint}</p>}
      </div>
    );
  }
);

TextBox.displayName = 'TextBox';
export default TextBox;

