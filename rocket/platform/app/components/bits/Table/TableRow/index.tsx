import React from 'react';

import styles from './styles.module.css';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableRow({
  children,
  className = '',
  ...props
}: TableRowProps): React.JSX.Element {
  return (
    <tr
      className={[styles.row, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </tr>
  );
}

export default TableRow;
