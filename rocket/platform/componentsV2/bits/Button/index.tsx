'use client';

import Link from 'next/link';
import React, {forwardRef} from 'react';

import styles from './styles.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  href?: string;
  target?: string;
  rel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(
  {
    variant = 'primary',
    size = 'md',
    href,
    target,
    rel,
    leftIcon,
    rightIcon,
    loading = false,
    fullWidth = false,
    classNameOverride,
    children,
    type = 'button',
    disabled,
    ...rest
  },
  ref,
) {
  const defaultClasses = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  const content = (
    <>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        leftIcon && <span className={styles.iconWrapper}>{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && (
        <span className={styles.iconWrapper}>{rightIcon}</span>
      )}
    </>
  );

  if (href) {
    const isInternal = href.startsWith('/') && !href.startsWith('//');
    if (isInternal) {
      return (
        <Link
          href={href}
          className={combinedClass}
          ref={ref as React.Ref<HTMLAnchorElement>}
          target={target}
          rel={rel}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </Link>
      );
    }

    return (
      <a
        href={href}
        className={combinedClass}
        ref={ref as React.Ref<HTMLAnchorElement>}
        target={target}
        rel={rel}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={combinedClass}
      ref={ref as React.Ref<HTMLButtonElement>}
      disabled={disabled || loading}
      suppressHydrationWarning
      {...rest}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
