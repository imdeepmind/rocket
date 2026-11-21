import React from 'react';

import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface WindowFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  dots?: boolean;
  headerBorder?: boolean;
  variant?: 'default' | 'glass';
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function WindowFrame({
  title,
  dots = true,
  headerBorder = true,
  variant = 'default',
  classNameOverride,
  children,
  ...props
}: WindowFrameProps): React.JSX.Element {
  const hasHeader = dots || Boolean(title);
  const defaultClasses = [
    styles.windowFrame,
    variant !== 'default' ? styles[variant] : '',
    !hasHeader ? styles.noHeader : '',
  ]
    .filter(Boolean)
    .join(' ');
  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <div className={combinedClass} {...props}>
      {(dots || title) && (
        <div
          className={`${styles.header} ${!headerBorder ? styles.noBorder : ''}`}
        >
          {dots && (
            <div className={styles.dots} aria-hidden="true">
              <span className={styles.dotClose} />
              <span className={styles.dotMinimize} />
              <span className={styles.dotMaximize} />
            </div>
          )}
          {title && (
            <Typography
              variant="caption"
              color="muted"
              classNameOverride={styles.title}
            >
              {title}
            </Typography>
          )}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
