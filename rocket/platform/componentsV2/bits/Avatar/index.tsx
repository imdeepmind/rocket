import Image from 'next/image';
import React from 'react';

import styles from './styles.module.css';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  initials?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'rounded';
  variant?: 'project' | 'user' | 'primary';
  classNameOverride?: string;
}

export default function Avatar({
  name,
  initials,
  src,
  size = 'md',
  shape = 'rounded',
  variant = 'project',
  classNameOverride,
  ...props
}: AvatarProps): React.JSX.Element {
  const displayInitials =
    initials ??
    (name.trim()
      ? variant === 'project'
        ? name.trim()[0].toUpperCase()
        : name
            .trim()
            .split(' ')
            .map(p => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
      : 'P');

  const defaultClasses = [
    styles.avatar,
    styles[size],
    styles[shape],
    styles[variant],
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  return (
    <div className={combinedClass} aria-label={name} title={name} {...props}>
      {src ? (
        <Image
          src={src}
          alt={name}
          width={40}
          height={40}
          className={styles.image}
        />
      ) : (
        <span className={styles.initials}>{displayInitials}</span>
      )}
    </div>
  );
}
