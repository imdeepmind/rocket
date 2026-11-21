import React from 'react';

import styles from './styles.module.css';

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableContainer({
  children,
  className = '',
  ...props
}: TableContainerProps): React.JSX.Element {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export default TableContainer;
