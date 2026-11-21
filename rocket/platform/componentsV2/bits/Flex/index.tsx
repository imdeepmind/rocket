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
  | '9'
  | '10'
  | '12'
  | '14'
  | '16'
  | '18'
  | '20'
  | 'auto';

export type FlexFlex = '1' | 'auto' | 'none' | 'initial';
export type FlexBasis =
  'sm' | 'md' | 'lg' | '420' | '440' | '460' | '480' | string;
export type FlexMinW = '0' | 'full';
export type FlexMaxW =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '520'
  | '600'
  | '720'
  | '840'
  | 'landing'
  | 'container'
  | string;
export type FlexOverflow = 'visible' | 'hidden' | 'scroll' | 'auto';
export type FlexListStyle = 'none' | 'disc' | 'decimal';
export type FlexPosition = 'relative' | 'absolute' | 'fixed';
export type FlexTextAlign = 'left' | 'center' | 'right';

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
  flex?: FlexFlex;
  basis?: FlexBasis;
  minW?: FlexMinW;
  maxW?: FlexMaxW;
  overflow?: FlexOverflow;
  overflowX?: FlexOverflow;
  borderTop?: boolean;
  borderBottom?: boolean;
  listStyle?: FlexListStyle;
  position?: FlexPosition;
  textAlign?: FlexTextAlign;
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
