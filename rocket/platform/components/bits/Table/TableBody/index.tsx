import React from 'react';

import styles from './styles.module.css';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({
  children,
  className = '',
  ...props
}: TableBodyProps): React.JSX.Element {
  return (
    <tbody
      className={[styles.body, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </tbody>
  );
}

export default TableBody;
