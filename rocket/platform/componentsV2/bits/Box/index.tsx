import React from 'react';

import styles from './styles.module.css';

export type BoxDisplay = 'block' | 'flex' | 'inline-block' | 'inline-flex';
export type BoxDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type BoxAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type BoxJustify =
  'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type BoxSpacingScale =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '12'
  | '14'
  | '16'
  | '18'
  | '20'
  | '24'
  | '30'
  | 'auto';

export type BoxFlex = '1' | 'auto' | 'none' | 'initial';
export type BoxBasis =
  'sm' | 'md' | 'lg' | '420' | '440' | '460' | '480' | string;
export type BoxMinW = '0' | 'full';
export type BoxMaxW =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '280'
  | '520'
  | '600'
  | '640'
  | '720'
  | '760'
  | '840'
  | 'landing'
  | 'container'
  | string;
export type BoxOverflow = 'visible' | 'hidden' | 'scroll' | 'auto';
export type BoxListStyle = 'none' | 'disc' | 'decimal';
export type BoxPosition = 'relative' | 'absolute' | 'fixed';
export type BoxTextAlign = 'left' | 'center' | 'right';

export type BoxProps<T extends React.ElementType = 'div'> = {
  as?: T;
  display?: BoxDisplay;
  direction?: BoxDirection;
  align?: BoxAlign;
  justify?: BoxJustify;
  gap?: BoxSpacingScale;
  m?: BoxSpacingScale;
  mt?: BoxSpacingScale;
  mb?: BoxSpacingScale;
  my?: BoxSpacingScale;
  mx?: BoxSpacingScale;
  p?: BoxSpacingScale;
  pt?: BoxSpacingScale;
  pb?: BoxSpacingScale;
  py?: BoxSpacingScale;
  px?: BoxSpacingScale;
  fullWidth?: boolean;
  flex?: BoxFlex;
  basis?: BoxBasis;
  minW?: BoxMinW;
  maxW?: BoxMaxW;
  overflow?: BoxOverflow;
  overflowX?: BoxOverflow;
  borderTop?: boolean;
  borderBottom?: boolean;
  listStyle?: BoxListStyle;
  position?: BoxPosition;
  textAlign?: BoxTextAlign;
  classNameOverride?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function Box<T extends React.ElementType = 'div'>({
  as,
  display,
  direction,
  align,
  justify,
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
  flex,
  basis,
  minW,
  maxW,
  overflow,
  overflowX,
  borderTop,
  borderBottom,
  listStyle,
  position,
  textAlign,
  classNameOverride,
  children,
  ...props
}: BoxProps<T>): React.JSX.Element {
  const Component = as || 'div';

  const defaultClasses = [
    styles.box,
    display ? styles[`display-${display}`] : '',
    direction ? styles[`direction-${direction}`] : '',
    align ? styles[`align-${align}`] : '',
    justify ? styles[`justify-${justify}`] : '',
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
    flex ? styles[`flex-${flex}`] : '',
    basis ? styles[`basis-${basis}`] : '',
    minW ? styles[`minW-${minW}`] : '',
    maxW ? styles[`maxW-${maxW}`] : '',
    overflow ? styles[`overflow-${overflow}`] : '',
    overflowX ? styles[`overflowX-${overflowX}`] : '',
    borderTop ? styles.borderTop : '',
    borderBottom ? styles.borderBottom : '',
    listStyle ? styles[`listStyle-${listStyle}`] : '',
    position ? styles[`position-${position}`] : '',
    textAlign ? styles[`textAlign-${textAlign}`] : '',
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
