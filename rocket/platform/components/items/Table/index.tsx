import React from 'react';

import Typography from '@/components/bits/Typography';

import styles from './styles.module.css';

export interface TableColumn<T> {
  header: React.ReactNode;
  accessor?: keyof T;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  className?: string;
}

export interface TableProps<
  T,
> extends React.TableHTMLAttributes<HTMLTableElement> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyText?: string;
  classNameOverride?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyText = 'No records found.',
  classNameOverride,
  ...props
}: TableProps<T>): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.container;

  return (
    <div className={combinedClass}>
      <table className={styles.table} {...props}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  width: col.width,
                  textAlign: col.align || 'left',
                }}
                className={[styles.headerCell, col.className]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Typography variant="caption" color="muted" weight="semibold">
                  {col.header}
                </Typography>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                <Typography variant="body-sm" color="muted">
                  {emptyText}
                </Typography>
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={keyExtractor(row)} className={styles.bodyRow}>
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                    }}
                    className={[styles.bodyCell, col.className]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render
                      ? col.render(row)
                      : col.accessor
                        ? String(row[col.accessor] ?? '')
                        : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
