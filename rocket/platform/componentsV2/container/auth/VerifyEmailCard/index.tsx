'use client';

import Link from 'next/link';
import React from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';
import MailIcon from '@/icons/MailIcon';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
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
      <div className={styles.container}>
        {/* Status Icon */}
        <div className={styles.iconWrapper}>
          {mode === 'success' && (
            <div className={[styles.iconCircle, styles.iconSuccess].join(' ')}>
              <CheckIcon width={32} height={32} stroke="currentColor" />
            </div>
          )}
          {mode === 'error' && (
            <div className={[styles.iconCircle, styles.iconError].join(' ')}>
              <CloseIcon width={32} height={32} stroke="currentColor" />
            </div>
          )}
          {mode === 'verifying' && (
            <div className={[styles.iconCircle, styles.iconPending].join(' ')}>
              <div className={styles.spinner} />
            </div>
          )}
          {mode === 'pending' && (
            <div className={[styles.iconCircle, styles.iconPending].join(' ')}>
              <MailIcon width={32} height={32} stroke="currentColor" />
            </div>
          )}
        </div>

        {/* Content based on mode */}
        {mode === 'pending' && (
          <div className={styles.contentBlock}>
            <Typography variant="body" classNameOverride={styles.description}>
              We sent a verification link to{' '}
              <span className={styles.emailHighlight}>
                {email || 'your email'}
              </span>
              . Click the link inside the email to complete your registration.
            </Typography>

            {resendSuccess && (
              <Alert
                variant="success"
                title="Email dispatched"
                message="A new verification link has been sent to your email."
                classNameOverride={styles.alert}
              />
            )}

            {error && (
              <Alert
                variant="error"
                title="Error"
                message={error}
                classNameOverride={styles.alert}
              />
            )}

            <div className={styles.actionRow}>
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
            </div>
          </div>
        )}

        {mode === 'verifying' && (
          <div className={styles.contentBlock}>
            <Typography
              variant="body-sm"
              classNameOverride={styles.description}
            >
              Confirming your security token with Rocket auth service...
            </Typography>
          </div>
        )}

        {mode === 'success' && (
          <div className={styles.contentBlock}>
            <Typography variant="body" classNameOverride={styles.description}>
              Your account is ready! You can now sign in to access your
              workspaces and deploy projects.
            </Typography>
            <Link href={signInHref} className={styles.buttonLink}>
              <Button variant="primary" fullWidth>
                Continue to sign in
              </Button>
            </Link>
          </div>
        )}

        {mode === 'error' && (
          <div className={styles.contentBlock}>
            {error ? (
              <Alert
                variant="error"
                title="Verification link invalid"
                message={error}
                classNameOverride={styles.alert}
              />
            ) : (
              <Typography variant="body" classNameOverride={styles.description}>
                This verification link is invalid or has expired. Please sign up
                again or request a new link.
              </Typography>
            )}
            <Link href={signUpHref} className={styles.buttonLink}>
              <Button variant="primary" fullWidth>
                Sign up again
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
