import React from 'react';

import styles from './styles.module.css';

export interface AmbientBackgroundProps {
  className?: string;
}

export function AmbientBackground({
  className = '',
}: AmbientBackgroundProps): React.JSX.Element {
  return (
    <div
      className={[styles.ambientContainer, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <div className={[styles.orb, styles.orb1].join(' ')} />
      <div className={[styles.orb, styles.orb2].join(' ')} />
      <div className={[styles.orb, styles.orb3].join(' ')} />
      <div className={[styles.orb, styles.orb4].join(' ')} />
    </div>
  );
}

export default AmbientBackground;
