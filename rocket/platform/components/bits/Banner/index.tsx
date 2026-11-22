'use client';

import React, {useState} from 'react';

import Button from '@/components/bits/Button';
import Flex from '@/components/bits/Flex';
import IconButton from '@/components/bits/IconButton';
import StatusDot, {type StatusDotVariant} from '@/components/bits/StatusDot';
import Tag from '@/components/bits/Tag';
import Typography from '@/components/bits/Typography';

import CloseIcon from '@/icons/CloseIcon';

import styles from './styles.module.css';

export type BannerVariant =
  'warning' | 'primary' | 'info' | 'success' | 'neutral';

export interface BannerAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BannerProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> {
  text?: React.ReactNode;
  variant?: BannerVariant;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  showDot?: boolean;
  action?: BannerAction;
  dismissible?: boolean;
  onDismiss?: () => void;
  classNameOverride?: string;
  children?: React.ReactNode;
}

export default function Banner({
  text,
  variant = 'warning',
  badge,
  icon,
  showDot = true,
  action,
  dismissible = false,
  onDismiss,
  classNameOverride,
  children,
  ...props
}: BannerProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  const defaultClasses = [styles.banner, styles[variant]]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride
    ? `${defaultClasses} ${classNameOverride}`
    : defaultClasses;

  const dotVariant: StatusDotVariant =
    variant === 'warning'
      ? 'warning'
      : variant === 'primary'
        ? 'error'
        : variant === 'info'
          ? 'info'
          : variant === 'success'
            ? 'success'
            : 'loading';

  const content = text ?? children;

  return (
    <Flex
      as="aside"
      role="status"
      aria-label={typeof content === 'string' ? content : 'Announcement'}
      align="center"
      justify="center"
      gap="2"
      wrap="wrap"
      px="4"
      py="2"
      fullWidth
      position="relative"
      classNameOverride={combinedClass}
      {...props}
    >
      {icon ??
        (showDot && (
          <StatusDot
            variant={dotVariant}
            pulse={variant === 'warning' || variant === 'primary'}
            size="sm"
          />
        ))}

      {badge &&
        (typeof badge === 'string' ? (
          <Tag
            variant={
              variant === 'warning'
                ? 'warning'
                : variant === 'primary'
                  ? 'primary'
                  : 'default'
            }
            size="sm"
          >
            {badge}
          </Tag>
        ) : (
          badge
        ))}

      <Typography
        as="span"
        variant="body-sm"
        weight="medium"
        classNameOverride={styles.text}
      >
        {content}
      </Typography>

      {action && (
        <Button
          size="xs"
          variant="ghost"
          href={action.href}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}

      {dismissible && (
        <IconButton
          icon={<CloseIcon width={14} height={14} />}
          aria-label="Dismiss banner"
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          classNameOverride={styles.dismissBtn}
        />
      )}
    </Flex>
  );
}
