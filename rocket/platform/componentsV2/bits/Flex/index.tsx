import React from 'react';

import styles from './styles.module.css';

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type FlexJustify =
  'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
export type FlexSpacingScale =
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

export type FlexProps<T extends React.ElementType = 'div'> = {
  as?: T;
  direction?: FlexDirection;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: FlexWrap;
  gap?: FlexSpacingScale;
  m?: FlexSpacingScale;
  mt?: FlexSpacingScale;
  mb?: FlexSpacingScale;
  my?: FlexSpacingScale;
  mx?: FlexSpacingScale;
  p?: FlexSpacingScale;
  pt?: FlexSpacingScale;
  pb?: FlexSpacingScale;
  py?: FlexSpacingScale;
  px?: FlexSpacingScale;
  fullWidth?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function Flex<T extends React.ElementType = 'div'>({
  as,
  direction = 'row',
  align,
  justify,
  wrap = 'nowrap',
  gap,
  m,
  mt,
  mb,
  my,
  mx,
  p,
  pt,
  pb,
  py,
  px,
  fullWidth = false,
  classNameOverride,
  children,
  ...props
}: FlexProps<T>): React.JSX.Element {
  const Component = as || 'div';

  const defaultClasses = [
    styles.flex,
    styles[`direction-${direction}`],
    align ? styles[`align-${align}`] : '',
    justify ? styles[`justify-${justify}`] : '',
    wrap !== 'nowrap' ? styles[`wrap-${wrap}`] : '',
    gap !== undefined ? styles[`gap-${gap}`] : '',
    m !== undefined ? styles[`m-${m}`] : '',
    mt !== undefined ? styles[`mt-${mt}`] : '',
    mb !== undefined ? styles[`mb-${mb}`] : '',
    my !== undefined ? styles[`my-${my}`] : '',
    mx !== undefined ? styles[`mx-${mx}`] : '',
    p !== undefined ? styles[`p-${p}`] : '',
    pt !== undefined ? styles[`pt-${pt}`] : '',
    pb !== undefined ? styles[`pb-${pb}`] : '',
    py !== undefined ? styles[`py-${py}`] : '',
    px !== undefined ? styles[`px-${px}`] : '',
    fullWidth ? styles.fullWidth : '',
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
