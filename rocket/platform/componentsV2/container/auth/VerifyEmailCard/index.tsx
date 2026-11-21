'use client';

import Link from 'next/link';
import React from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';
import MailIcon from '@/icons/MailIcon';

import Alert from '@/componentsV2/bits/Alert';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';
import AuthShell from '@/componentsV2/container/auth/AuthShell';

import styles from './styles.module.css';

export interface VerifyEmailCardProps {
  mode?: 'pending' | 'verifying' | 'success' | 'error';
  email?: string;
  error?: string | null;
  onResend?: () => void;
  isResending?: boolean;
  resendSuccess?: boolean;
  cooldownSeconds?: number;
  signInHref?: string;
  signUpHref?: string;
  classNameOverride?: string;
}

export default function VerifyEmailCard({
  mode = 'pending',
  email = '',
  error = null,
  onResend,
  isResending = false,
  resendSuccess = false,
  cooldownSeconds = 0,
  signInHref = '/auth/sign-in',
  signUpHref = '/auth/sign-up',
  classNameOverride,
}: VerifyEmailCardProps): React.JSX.Element {
  const title =
    mode === 'success'
      ? 'Email verified'
      : mode === 'error'
        ? 'Verification failed'
        : mode === 'verifying'
          ? 'Verifying email...'
          : 'Verify your email';

  const subtitle =
    mode === 'success'
      ? 'Your email address has been verified successfully.'
      : mode === 'error'
        ? 'There was a problem verifying your email address.'
        : mode === 'verifying'
          ? 'Please wait while we confirm your verification link.'
          : 'We have dispatched a verification link to your email.';

  const footer = (
    <Link href={signInHref} className={styles.backLink}>
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      footer={footer}
      classNameOverride={classNameOverride}
    >
      <Flex direction="column" align="center" gap="5" fullWidth>
        {/* Status Icon */}
        <Flex align="center" justify="center" fullWidth>
          {mode === 'success' && (
            <Flex
              align="center"
              justify="center"
              classNameOverride={[styles.iconCircle, styles.iconSuccess].join(
                ' ',
              )}
            >
              <CheckIcon width={32} height={32} stroke="currentColor" />
            </Flex>
          )}
          {mode === 'error' && (
            <Flex
              align="center"
              justify="center"
              classNameOverride={[styles.iconCircle, styles.iconError].join(
                ' ',
              )}
            >
              <CloseIcon width={32} height={32} stroke="currentColor" />
            </Flex>
          )}
          {mode === 'verifying' && (
            <Flex
              align="center"
              justify="center"
              classNameOverride={[styles.iconCircle, styles.iconPending].join(
                ' ',
              )}
            >
              <Box classNameOverride={styles.spinner} />
            </Flex>
          )}
          {mode === 'pending' && (
            <Flex
              align="center"
              justify="center"
              classNameOverride={[styles.iconCircle, styles.iconPending].join(
                ' ',
              )}
            >
              <MailIcon width={32} height={32} stroke="currentColor" />
            </Flex>
          )}
        </Flex>

        {/* Content based on mode */}
        {mode === 'pending' && (
          <Flex direction="column" align="center" gap="4" fullWidth>
            <Typography
              variant="body"
              align="center"
              color="muted"
              classNameOverride={styles.description}
            >
              We sent a verification link to{' '}
              <Typography as="span" weight="medium" color="default">
                {email || 'your email'}
              </Typography>
              . Click the link inside the email to complete your registration.
            </Typography>

            {resendSuccess && (
              <Box fullWidth>
                <Alert
                  variant="success"
                  title="Email dispatched"
                  message="A new verification link has been sent to your email."
                />
              </Box>
            )}

            {error && (
              <Box fullWidth>
                <Alert variant="error" title="Error" message={error} />
              </Box>
            )}

            <Box mt="2" fullWidth>
              <Button
                variant="secondary"
                fullWidth
                disabled={isResending || cooldownSeconds > 0}
                onClick={onResend}
              >
                {isResending
                  ? 'Dispatched link...'
                  : cooldownSeconds > 0
                    ? `Resend available in ${cooldownSeconds}s`
                    : 'Resend verification email'}
              </Button>
            </Box>
          </Flex>
        )}

        {mode === 'verifying' && (
          <Flex direction="column" align="center" fullWidth>
            <Typography
              variant="body-sm"
              align="center"
              color="muted"
              classNameOverride={styles.description}
            >
              Confirming your security token with Rocket auth service...
            </Typography>
          </Flex>
        )}

        {mode === 'success' && (
          <Flex direction="column" align="center" gap="4" fullWidth>
            <Typography
              variant="body"
              align="center"
              color="muted"
              classNameOverride={styles.description}
            >
              Your account is ready! You can now sign in to access your
              workspaces and deploy projects.
            </Typography>
            <Box fullWidth>
              <Link href={signInHref} className={styles.buttonLink}>
                <Button variant="primary" fullWidth>
                  Continue to sign in
                </Button>
              </Link>
            </Box>
          </Flex>
        )}

        {mode === 'error' && (
          <Flex direction="column" align="center" gap="4" fullWidth>
            {error ? (
              <Box fullWidth>
                <Alert
                  variant="error"
                  title="Verification link invalid"
                  message={error}
                />
              </Box>
            ) : (
              <Typography
                variant="body"
                align="center"
                color="muted"
                classNameOverride={styles.description}
              >
                This verification link is invalid or has expired. Please sign up
                again or request a new link.
              </Typography>
            )}
            <Box fullWidth>
              <Link href={signUpHref} className={styles.buttonLink}>
                <Button variant="primary" fullWidth>
                  Sign up again
                </Button>
              </Link>
            </Box>
          </Flex>
        )}
      </Flex>
    </AuthShell>
  );
}
