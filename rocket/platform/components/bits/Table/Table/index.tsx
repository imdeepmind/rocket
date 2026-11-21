import React from 'react';

import styles from './styles.module.css';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  className?: string;
}

export function Table({
  children,
  className = '',
  ...props
}: TableProps): React.JSX.Element {
  return (
    <table
      className={[styles.table, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </table>
  );
}

export default Table;
