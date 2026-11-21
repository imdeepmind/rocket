'use client';

import React, {forwardRef, useId} from 'react';

import Typography from '@/componentsV2/bits/Typography';

import ChevronDownIcon from '@/icons/ChevronDownIcon';

import styles from './styles.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'size'
> {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  sizeVariant?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
  fullWidth?: boolean;
  classNameOverride?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      hint,
      error,
      sizeVariant = 'md',
      options,
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
      styles.selectWrapper,
      styles[sizeVariant],
      error ? styles.selectError : '',
    ]
      .filter(Boolean)
      .join(' ');

    const selectClasses = classNameOverride ?? styles.select;

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}

        <div className={wrapperClasses}>
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            className={selectClasses}
            {...rest}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className={styles.arrowIcon} aria-hidden="true">
            <ChevronDownIcon width={16} height={16} />
          </span>
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

Select.displayName = 'Select';
export default Select;
