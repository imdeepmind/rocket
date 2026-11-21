'use client';

import React from 'react';

import BaseTable from '@/components/bits/Table/Table';
import TableBody from '@/components/bits/Table/TableBody';
import TableCell from '@/components/bits/Table/TableCell';
import TableContainer from '@/components/bits/Table/TableContainer';
import TableHead from '@/components/bits/Table/TableHead';
import TableHeader from '@/components/bits/Table/TableHeader';
import TableRow from '@/components/bits/Table/TableRow';

import styles from './styles.module.css';

export interface TableColumn<T> {
  key?: string;
  header: React.ReactNode;
  accessor?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  className?: string;
  headClassName?: string;
  ariaLabel?: string;
}

export interface UnifiedTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  emptyMessage?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  onRowClick?: (item: T, index: number) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No items found.',
  className = '',
  containerClassName = '',
  onRowClick,
}: UnifiedTableProps<T>): React.JSX.Element {
  return (
    <TableContainer className={containerClassName}>
      <BaseTable className={className}>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead
                key={
                  col.key || (typeof col.header === 'string' ? col.header : idx)
                }
                align={col.align}
                style={{width: col.width}}
                className={col.headClassName}
                aria-label={col.ariaLabel}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className={styles.emptyCell}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, rowIdx) => (
              <TableRow
                key={keyExtractor(item, rowIdx)}
                onClick={() => onRowClick?.(item, rowIdx)}
                className={onRowClick ? styles.clickableRow : ''}
              >
                {columns.map((col, colIdx) => {
                  let content: React.ReactNode = null;
                  if (col.render) {
                    content = col.render(item, rowIdx);
                  } else if (col.accessor) {
                    content = String(item[col.accessor] ?? '');
                  }

                  return (
                    <TableCell
                      key={
                        col.key ||
                        (typeof col.header === 'string' ? col.header : colIdx)
                      }
                      align={col.align}
                      style={{width: col.width}}
                      className={col.className}
                    >
                      {content}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </BaseTable>
    </TableContainer>
  );
}

export default Table;
