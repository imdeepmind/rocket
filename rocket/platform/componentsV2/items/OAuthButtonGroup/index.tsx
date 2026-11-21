'use client';

import React from 'react';

import GithubIcon from '@/icons/GithubIcon';
import GoogleIcon from '@/icons/GoogleIcon';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface OAuthButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  dividerText?: string;
  onProviderClick?: (provider: 'Google' | 'GitHub') => void;
  notice?: string | null;
  onDismissNotice?: () => void;
  classNameOverride?: string;
}

export default function OAuthButtonGroup({
  dividerText = 'or continue with email',
  onProviderClick,
  notice,
  onDismissNotice,
  classNameOverride,
  ...props
}: OAuthButtonGroupProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.container;

  return (
    <div className={combinedClass} {...props}>
      <div className={styles.buttonGrid}>
        <Button
          variant="secondary"
          size="md"
          leftIcon={<GoogleIcon width={18} height={18} />}
          onClick={() => onProviderClick?.('Google')}
          fullWidth
          aria-label="Continue with Google"
        >
          Google
        </Button>

        <Button
          variant="secondary"
          size="md"
          leftIcon={<GithubIcon width={18} height={18} />}
          onClick={() => onProviderClick?.('GitHub')}
          fullWidth
          aria-label="Continue with GitHub"
        >
          GitHub
        </Button>
      </div>

      {notice && (
        <div className={styles.noticeWrapper}>
          <Alert
            variant="warning"
            message={notice}
            dismissible={Boolean(onDismissNotice)}
            onDismiss={onDismissNotice}
          />
        </div>
      )}

      {dividerText && (
        <div className={styles.divider}>
          <div className={styles.line} />
          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.dividerText}
          >
            {dividerText}
          </Typography>
          <div className={styles.line} />
        </div>
      )}
    </div>
  );
}
