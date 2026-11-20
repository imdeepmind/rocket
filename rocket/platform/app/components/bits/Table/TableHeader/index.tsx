import React from 'react';

import styles from './styles.module.css';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({
  children,
  className = '',
  ...props
}: TableHeaderProps): React.JSX.Element {
  return (
    <thead
      className={[styles.header, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </thead>
  );
}

export default TableHeader;
