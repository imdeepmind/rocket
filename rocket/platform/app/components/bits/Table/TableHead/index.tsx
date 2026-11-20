import React from 'react';

import styles from './styles.module.css';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
}

export function TableHead({
  children,
  className = '',
  ...props
}: TableHeadProps): React.JSX.Element {
  return (
    <th
      className={[styles.headCell, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </th>
  );
}

export default TableHead;
