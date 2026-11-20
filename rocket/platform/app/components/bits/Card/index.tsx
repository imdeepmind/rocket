import React from 'react';

import styles from './styles.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}: CardProps): React.JSX.Element {
  const padClass =
    padding === 'none'
      ? styles.padNone
      : padding === 'sm'
        ? styles.padSm
        : padding === 'lg'
          ? styles.padLg
          : styles.padMd;

  return (
    <div
      className={[
        styles.card,
        padClass,
        interactive ? styles.interactive : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
