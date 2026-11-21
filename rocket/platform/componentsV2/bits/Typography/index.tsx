import React from 'react';

import styles from './styles.module.css';

export type TypographyVariant =
  | 'hero'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'lead'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'eyebrow'
  | 'mono';

export type TypographyColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'white';

export interface TypographyProps<T extends React.ElementType = 'p'> {
  as?: T;
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
}

const DEFAULT_TAG_MAP: Record<TypographyVariant, React.ElementType> = {
  hero: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  lead: 'p',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  eyebrow: 'div',
  mono: 'span',
};

export default function Typography<T extends React.ElementType = 'p'>({
  as,
  variant = 'body',
  color = 'default',
  weight,
  align,
  truncate = false,
  classNameOverride,
  children,
  ...rest
}: TypographyProps<T> &
  Omit<
    React.ComponentPropsWithoutRef<T>,
    keyof TypographyProps<T>
  >): React.JSX.Element {
  const Component = as || DEFAULT_TAG_MAP[variant] || 'p';

  const defaultClasses = [
    styles.typography,
    styles[variant],
    color !== 'default' ? styles[`color-${color}`] : '',
    weight ? styles[`weight-${weight}`] : '',
    align ? styles[`align-${align}`] : '',
    truncate ? styles.truncate : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? defaultClasses;

  return (
    <Component className={combinedClass} {...rest}>
      {children}
    </Component>
  );
}
