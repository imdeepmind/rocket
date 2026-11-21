import React from 'react';

import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface WindowFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  dots?: boolean;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function WindowFrame({
  title,
  dots = true,
  classNameOverride,
  children,
  ...props
}: WindowFrameProps): React.JSX.Element {
  const defaultClasses = [styles.windowFrame].join(' ');
  const combinedClass = classNameOverride ?? defaultClasses;

  return (
    <div className={combinedClass} {...props}>
      <div className={styles.header}>
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
      <div className={styles.content}>{children}</div>
    </div>
  );
}
