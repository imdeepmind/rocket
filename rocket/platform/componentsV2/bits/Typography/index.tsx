import React from 'react';

import styles from './styles.module.css';

export type TypographyVariant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'lead'
  | 'body'
  | 'body-lg'
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
  | 'success-muted'
  | 'warning'
  | 'error'
  | 'white';

export interface TypographyProps<T extends React.ElementType = 'p'> {
  as?: T;
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  maxW?:
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '280'
    | '520'
    | '600'
    | '640'
    | '720'
    | '760'
    | string;
  truncate?: boolean;
  transform?: 'uppercase' | 'capitalize' | 'lowercase';
  letterSpacing?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider';
  classNameOverride?: string;
  children?: React.ReactNode;
}

const DEFAULT_TAG_MAP: Record<TypographyVariant, React.ElementType> = {
  hero: 'h1',
  display: 'h2',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  lead: 'p',
  body: 'p',
  'body-lg': 'p',
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
  maxW,
  truncate = false,
  transform,
  letterSpacing,
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
    maxW ? styles[`maxW-${maxW}`] : '',
    truncate ? styles.truncate : '',
    transform ? styles[`transform-${transform}`] : '',
    letterSpacing ? styles[`tracking-${letterSpacing}`] : '',
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
