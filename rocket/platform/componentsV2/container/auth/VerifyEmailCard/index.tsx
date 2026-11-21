'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import React, {useEffect, useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';
import AuthShell from '@/componentsV2/container/auth/AuthShell';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';
import MailIcon from '@/icons/MailIcon';

import {sendVerificationEmail, verifyEmail} from '@/lib/auth/client';

import styles from './styles.module.css';

function extractEmailFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      const parsed = JSON.parse(json);
      return typeof parsed.email === 'string' ? parsed.email : null;
    }
  } catch {
    // Malformed token fallback
  }
  return null;
}

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
  mode: propMode,
  email: propEmail,
  error: propError,
  onResend,
  isResending: propIsResending,
  resendSuccess: propResendSuccess,
  cooldownSeconds: propCooldownSeconds,
  signInHref = '/auth/sign-in',
  signUpHref = '/auth/sign-up',
  classNameOverride,
}: VerifyEmailCardProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const initialMode = propMode ?? (token ? 'verifying' : 'pending');
  const initialEmail =
    propEmail ??
    (emailParam || (token ? extractEmailFromToken(token) || '' : ''));

  const [mode, setMode] = useState<
    'pending' | 'verifying' | 'success' | 'error'
  >(initialMode);
  const [email, setEmail] = useState<string>(initialEmail);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalResending, setInternalResending] = useState(false);
  const [internalResendSuccess, setInternalResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(propCooldownSeconds ?? 0);

  const activeMode = propMode ?? mode;
  const activeEmail = propEmail ?? email;
  const activeError = propError !== undefined ? propError : internalError;
  const activeResending = propIsResending ?? internalResending;
  const activeResendSuccess = propResendSuccess ?? internalResendSuccess;
  const activeCooldown =
    propCooldownSeconds !== undefined ? propCooldownSeconds : cooldown;

  useEffect(() => {
    if (propMode || !token) return;

    let isMounted = true;
    async function performVerification() {
      const result = await verifyEmail({token: token!});
      if (!isMounted) return;

      if (result.success) {
        if (result.data?.user?.email) {
          setEmail(result.data.user.email);
        }
        setMode('success');
        setInternalError(null);
      } else {
        setMode('error');
        setInternalError(
          result.error ||
            'This verification link is invalid or has expired. Please sign up again.',
        );
      }
    }

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [token, propMode]);

  useEffect(() => {
    if (activeCooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCooldown]);

  async function handleResend() {
    if (onResend) {
      onResend();
      return;
    }

    if (!activeEmail) {
      setInternalError('Email address is missing. Please sign up again.');
      return;
    }

    setInternalError(null);
    setInternalResendSuccess(false);
    setInternalResending(true);

    const result = await sendVerificationEmail(activeEmail);
    setInternalResending(false);

    if (!result.success) {
      setInternalError(result.error);
      return;
    }

    setInternalResendSuccess(true);
    setCooldown(60);
  }

  const title =
    activeMode === 'success'
      ? 'Email verified'
      : activeMode === 'error'
        ? 'Verification failed'
        : activeMode === 'verifying'
          ? 'Verifying email...'
          : 'Verify your email';

  const subtitle =
    activeMode === 'success'
      ? 'Your email address has been verified successfully.'
      : activeMode === 'error'
        ? 'There was a problem verifying your email address.'
        : activeMode === 'verifying'
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
      {activeMode === 'pending' && (
        <Flex direction="column" align="center" fullWidth>
          <Flex
            align="center"
            justify="center"
            mb="4"
            classNameOverride={styles.iconCircle}
          >
            <MailIcon width={24} height={24} />
          </Flex>

          <Flex direction="column" align="center" gap="1" mb="5">
            <Typography variant="body" color="muted" align="center">
              We sent a verification link to:
            </Typography>
            {activeEmail && (
              <Typography variant="body" weight="semibold" align="center">
                {activeEmail}
              </Typography>
            )}
            <Typography variant="body-sm" color="muted" align="center">
              Click the link inside to activate your account.
            </Typography>
          </Flex>

          {activeResendSuccess && (
            <Box mb="4" fullWidth>
              <Alert
                variant="success"
                message="Verification email resent. Please check your inbox."
              />
            </Box>
          )}

          {activeError && (
            <Box mb="4" fullWidth>
              <Alert variant="error" message={activeError} />
            </Box>
          )}

          <Flex direction="column" gap="3" fullWidth>
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={handleResend}
              loading={activeResending}
              disabled={activeResending || activeCooldown > 0}
            >
              {activeCooldown > 0
                ? `Resend in ${activeCooldown}s`
                : activeResending
                  ? 'Sending...'
                  : 'Resend email'}
            </Button>

            <Button href={signInHref} variant="primary" size="md" fullWidth>
              Sign in to Rocket
            </Button>
          </Flex>
        </Flex>
      )}

      {activeMode === 'verifying' && (
        <Flex direction="column" align="center" fullWidth p="6">
          <Box classNameOverride={styles.spinner} mb="4" />
          <Typography variant="body" color="muted">
            Checking verification token...
          </Typography>
        </Flex>
      )}

      {activeMode === 'success' && (
        <Flex direction="column" align="center" fullWidth>
          <Flex
            align="center"
            justify="center"
            mb="4"
            classNameOverride={styles.iconCircle}
          >
            <CheckIcon width={24} height={24} />
          </Flex>

          <Flex direction="column" align="center" gap="1" mb="6">
            <Typography variant="h3" as="h2" align="center">
              Verification Complete
            </Typography>
            <Typography variant="body" color="muted" align="center">
              Your email has been verified. You can now sign in to your account
              and deploy backends.
            </Typography>
          </Flex>

          <Button href={signInHref} variant="primary" size="md" fullWidth>
            Sign in to your account
          </Button>
        </Flex>
      )}

      {activeMode === 'error' && (
        <Flex direction="column" align="center" fullWidth>
          <Flex
            align="center"
            justify="center"
            mb="4"
            classNameOverride={`${styles.iconCircle} ${styles.errorCircle}`}
          >
            <CloseIcon width={24} height={24} />
          </Flex>

          <Flex direction="column" align="center" gap="1" mb="5">
            <Typography variant="h3" as="h2" align="center">
              Verification Failed
            </Typography>
            <Typography variant="body" color="muted" align="center">
              {activeError ||
                'This link is invalid or has expired. Please sign up again.'}
            </Typography>
          </Flex>

          <Flex direction="column" gap="3" fullWidth>
            <Button href={signUpHref} variant="primary" size="md" fullWidth>
              Sign up again
            </Button>

            <Button href={signInHref} variant="outline" size="md" fullWidth>
              Return to sign in
            </Button>
          </Flex>
        </Flex>
      )}
    </AuthShell>
  );
}
