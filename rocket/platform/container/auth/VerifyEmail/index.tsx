'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import React, {useEffect, useState} from 'react';

import AuthShell from '@/container/auth/AuthShell';

import Button from '@/components/bits/Button';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';
import MailIcon from '@/icons/MailIcon';

import {sendVerificationEmail, verifyEmail} from '@/lib/auth/client';

import styles from './styles.module.css';

/**
 * Safely extracts the email payload from a Better Auth JWT verification token.
 */
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
    // Graceful fallback if token is malformed
  }
  return null;
}

export default function VerifyEmail(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  // Mode: if token is present, start in verifying; otherwise pending (user sign-up redirect)
  const [mode, setMode] = useState<
    'pending' | 'verifying' | 'success' | 'error'
  >(token ? 'verifying' : 'pending');

  // Email: either from query param or extracted from token
  const [email, setEmail] = useState<string>(
    emailParam || (token ? extractEmailFromToken(token) || '' : ''),
  );

  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // When token is provided, verify it (no auto-login, just validation)
  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function performVerification() {
      const result = await verifyEmail({token: token!});
      if (!isMounted) return;

      if (result.success) {
        if (result.data?.user?.email) {
          setEmail(result.data.user.email);
        }
        setMode('success');
        setError(null);
      } else {
        setMode('error');
        setError(
          result.error ||
            'This verification link is invalid or has expired. Please sign up again.',
        );
      }
    }

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Cooldown countdown timer for resending
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!email) {
      setError('Email address is missing. Please sign up again.');
      return;
    }

    setError(null);
    setResendSuccess(false);
    setIsResending(true);

    const result = await sendVerificationEmail(email);
    setIsResending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setResendSuccess(true);
    setCooldown(60);
  }

  const footer = (
    <Link href="/auth/sign-in" className={styles.backLink}>
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title={
        mode === 'success'
          ? 'Email verified'
          : mode === 'error'
            ? 'Verification failed'
            : mode === 'verifying'
              ? 'Verifying email...'
              : 'Verify your email'
      }
      subtitle={
        mode === 'success'
          ? 'Your email address has been verified successfully.'
          : mode === 'error'
            ? 'There was a problem verifying your email address.'
            : mode === 'verifying'
              ? 'Please wait while we confirm your verification link.'
              : 'We have dispatched a verification link to your email.'
      }
      footer={footer}
    >
      {mode === 'verifying' && (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.mailIcon}`}
            aria-hidden="true"
          >
            <MailIcon width={28} height={28} />
          </div>
          <h2 className={styles.title}>Verifying your email...</h2>
          <p className={styles.description}>
            Please wait a moment while we verify your verification link.
          </p>
        </div>
      )}

      {mode === 'pending' && (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.mailIcon}`}
            aria-hidden="true"
          >
            <MailIcon width={28} height={28} />
          </div>

          <h2 className={styles.title}>Check your inbox</h2>

          {email && <span className={styles.emailHighlight}>{email}</span>}

          <p className={styles.description}>
            We sent a verification link to your email. Click the link inside to
            activate your account. If you don&apos;t see it, check your spam
            folder.
          </p>

          {error && (
            <div
              className={`${styles.feedbackBanner} ${styles.errorBanner}`}
              role="alert"
            >
              {error}
            </div>
          )}

          {resendSuccess && (
            <div
              className={`${styles.feedbackBanner} ${styles.successBanner}`}
              role="status"
            >
              A new verification link has been sent to your inbox.
            </div>
          )}

          <div className={styles.actionRow}>
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              disabled={isResending || cooldown > 0}
              onClick={handleResend}
            >
              {isResending
                ? 'Sending link...'
                : cooldown > 0
                  ? `Resend link in ${cooldown}s`
                  : 'Resend verification link'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'success' && (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.successIcon}`}
            aria-hidden="true"
          >
            <CheckIcon width={26} height={26} />
          </div>

          <h2 className={styles.title}>Email verified successfully</h2>

          {email && <span className={styles.emailHighlight}>{email}</span>}

          <p className={styles.description}>
            Your email has been confirmed. You can now sign in to your Rocket
            account with your email and password.
          </p>

          <div className={styles.actionRow}>
            <Button href="/auth/sign-in" variant="primary" size="md" fullWidth>
              Proceed to sign in
            </Button>
          </div>
        </div>
      )}

      {mode === 'error' && (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.errorIcon}`}
            aria-hidden="true"
          >
            <CloseIcon width={26} height={26} />
          </div>

          <h2 className={styles.title}>Verification link expired</h2>
          <p className={styles.description}>
            {error ||
              'This email verification link is invalid or has expired. Please create an account or sign up again.'}
          </p>

          <div className={styles.actionRow}>
            <Button href="/auth/sign-up" variant="primary" size="md" fullWidth>
              Create an account
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
