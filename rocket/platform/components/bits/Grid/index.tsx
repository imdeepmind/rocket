import React from 'react';

import styles from './styles.module.css';

export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto-fit' | 'auto-fill';
export type GridSpacingScale =
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
  | '16';

export type GridProps<T extends React.ElementType = 'div'> = {
  as?: T;
  columns?: GridColumns;
  minItemWidth?: 'sm' | 'md' | 'lg' | '240' | '280' | string;
  gap?: GridSpacingScale;
  rowGap?: GridSpacingScale;
  columnGap?: GridSpacingScale;
  fullWidth?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function Grid<T extends React.ElementType = 'div'>({
  as,
  columns,
  minItemWidth,
  gap,
  rowGap,
  columnGap,
  fullWidth = true,
  classNameOverride,
  children,
  style,
  ...props
}: GridProps<T>): React.JSX.Element {
  const Component = as || 'div';

  const defaultClasses = [
    styles.grid,
    columns && typeof columns === 'number' ? styles[`cols-${columns}`] : '',
    minItemWidth ? styles[`min-${minItemWidth}`] : '',
    gap !== undefined ? styles[`gap-${gap}`] : '',
    rowGap !== undefined ? styles[`rowGap-${rowGap}`] : '',
    columnGap !== undefined ? styles[`columnGap-${columnGap}`] : '',
    fullWidth ? styles.fullWidth : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <Component className={combinedClass} style={style} {...props}>
      {children}
    </Component>
  );
}
