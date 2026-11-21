'use client';

import React from 'react';

import Alert from '@/components/bits/Alert';
import Box from '@/components/bits/Box';
import Button from '@/components/bits/Button';
import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';

import GithubIcon from '@/icons/GithubIcon';
import GoogleIcon from '@/icons/GoogleIcon';

import styles from './styles.module.css';

export interface OAuthButtonGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'className'
> {
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
  return (
    <Flex
      direction="column"
      fullWidth
      classNameOverride={classNameOverride}
      {...props}
    >
      <Box classNameOverride={styles.buttonGrid}>
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
      </Box>

      {notice && (
        <Box mt="3" fullWidth>
          <Alert
            variant="warning"
            message={notice}
            dismissible={Boolean(onDismissNotice)}
            onDismiss={onDismissNotice}
          />
        </Box>
      )}

      {dividerText && (
        <Flex align="center" gap="3" fullWidth my="5">
          <Box classNameOverride={styles.line} />
          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.dividerText}
          >
            {dividerText}
          </Typography>
          <Box classNameOverride={styles.line} />
        </Flex>
      )}
    </Flex>
  );
}
