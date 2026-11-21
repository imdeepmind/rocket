import React from 'react';

import styles from './styles.module.css';

export type TextVariant =
  | 'hero'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'eyebrow'
  | 'lead'
  | 'body'
  | 'caption'
  | 'muted'
  | 'mono';

export type TextColor =
  'default' | 'primary' | 'secondary' | 'muted' | 'accent' | 'white';

export interface TextProps<T extends React.ElementType = 'p'> {
  as?: T;
  variant?: TextVariant;
  color?: TextColor;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_TAG_MAP: Record<TextVariant, React.ElementType> = {
  hero: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  eyebrow: 'div',
  lead: 'p',
  body: 'p',
  caption: 'span',
  muted: 'span',
  mono: 'span',
};

export function Text<T extends React.ElementType = 'p'>({
  as,
  variant = 'body',
  color = 'default',
  weight,
  align,
  className = '',
  children,
  ...rest
}: TextProps<T> &
  Omit<
    React.ComponentPropsWithoutRef<T>,
    keyof TextProps<T>
  >): React.JSX.Element {
  const Component = as || DEFAULT_TAG_MAP[variant] || 'p';

  const combinedClassName = [
    styles.text,
    styles[variant],
    color !== 'default' ? styles[`color-${color}`] : '',
    weight ? styles[`weight-${weight}`] : '',
    align ? styles[`align-${align}`] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={combinedClassName} {...rest}>
      {children}
    </Component>
  );
}

export default Text;
