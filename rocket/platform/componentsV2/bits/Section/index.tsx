import React from 'react';

import styles from './styles.module.css';

export type SectionContainer = 'landing' | 'content' | 'fluid' | 'narrow';
export type SectionSpacing = 'none' | 'sm' | 'md' | 'lg' | 'hero';
export type SectionAlign = 'left' | 'center' | 'right';
export type SectionSpacingScale =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '10'
  | '12'
  | '14'
  | '16'
  | '18'
  | '20';

export type SectionProps<T extends React.ElementType = 'section'> = {
  as?: T;
  container?: SectionContainer;
  spacing?: SectionSpacing;
  align?: SectionAlign;
  position?: 'relative' | 'static';
  overflow?: 'visible' | 'hidden';
  pt?: SectionSpacingScale;
  pb?: SectionSpacingScale;
  classNameOverride?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function Section<T extends React.ElementType = 'section'>({
  as,
  container,
  spacing,
  align,
  position,
  overflow,
  pt,
  pb,
  classNameOverride,
  children,
  ...props
}: SectionProps<T>): React.JSX.Element {
  const Component = as || 'section';

  const defaultClasses = [
    styles.section,
    container ? styles[`container-${container}`] : '',
    spacing ? styles[`spacing-${spacing}`] : '',
    align ? styles[`align-${align}`] : '',
    position ? styles[`position-${position}`] : '',
    overflow ? styles[`overflow-${overflow}`] : '',
    pt !== undefined ? styles[`pt-${pt}`] : '',
    pb !== undefined ? styles[`pb-${pb}`] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <Component className={combinedClass} {...props}>
      {children}
    </Component>
  );
}
