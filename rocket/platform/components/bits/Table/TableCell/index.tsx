import React from 'react';

import styles from './styles.module.css';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
}

export function TableCell({
  children,
  className = '',
  ...props
}: TableCellProps): React.JSX.Element {
  return (
    <td
      className={[styles.cell, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </td>
  );
}

export default TableCell;
