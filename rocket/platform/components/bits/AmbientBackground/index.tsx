import React from 'react';

import styles from './styles.module.css';

export interface AmbientBackgroundProps {
  className?: string;
  classNameOverride?: string;
}

export function AmbientBackground({
  className = '',
  classNameOverride,
}: AmbientBackgroundProps): React.JSX.Element {
  const containerClass =
    classNameOverride ??
    [styles.ambientContainer, className].filter(Boolean).join(' ');

  return (
    <div className={containerClass} aria-hidden="true">
      <div className={[styles.orb, styles.orb1].join(' ')} />
      <div className={[styles.orb, styles.orb2].join(' ')} />
      <div className={[styles.orb, styles.orb3].join(' ')} />
      <div className={[styles.orb, styles.orb4].join(' ')} />
    </div>
  );
}

export default AmbientBackground;
