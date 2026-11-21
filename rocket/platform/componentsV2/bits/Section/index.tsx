import React from 'react';

import styles from './styles.module.css';

export type SectionProps<T extends React.ElementType = 'section'> = {
  as?: T;
  classNameOverride?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function Section<T extends React.ElementType = 'section'>({
  as,
  classNameOverride,
  children,
  ...props
}: SectionProps<T>): React.JSX.Element {
  const Component = as || 'section';
  const combinedClass = classNameOverride ?? styles.section;

  return (
    <Component className={combinedClass} {...props}>
      {children}
    </Component>
  );
}
