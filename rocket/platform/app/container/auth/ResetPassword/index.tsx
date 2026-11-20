'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TextBox from '@/app/components/bits/TextBox';
import Button from '@/app/components/bits/Button';
import { CheckIcon, CloseIcon } from '@/app/icons';
import { authClient } from '@/app/lib/auth/client';
import AuthShell from '../AuthShell';
import styles from './styles.module.css';

export default function ResetPassword(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const errorParam = searchParams.get('error');

  const initialMode =
    errorParam || searchParams.get('status') === 'error' || searchParams.get('state') === 'error'
      ? 'error'
      : 'success';

  const [mode, setMode] = useState<'success' | 'error'>(initialMode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      if (token) {
        const result = await authClient.resetPassword({
          newPassword,
          token,
        });

        if (result.error) {
          setError(result.error.message || 'Failed to reset password');
          setIsSubmitting(false);
          return;
        }
      }

      setIsCompleted(true);
      setIsSubmitting(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      setIsSubmitting(false);
    }
  }

  const footer = (
    <Link href="/auth/sign-in" className={styles.backLink}>
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title={mode === 'success' ? 'Reset your password' : 'Reset link issue'}
      subtitle={
        mode === 'success'
          ? 'Enter a new password for your Rocket account.'
          : 'There was a problem with your password reset link.'
      }
      footer={footer}
    >
      {/* Dev preview toggle for switching between success and error */}
      <div className={styles.previewSwitcher} role="group" aria-label="Preview State Switcher">
        <button
          type="button"
          className={`${styles.previewTab} ${mode === 'success' ? styles.previewTabActive : ''}`}
          onClick={() => {
            setMode('success');
            setError(null);
          }}
          aria-pressed={mode === 'success'}
        >
          Success state
        </button>
        <button
          type="button"
          className={`${styles.previewTab} ${mode === 'error' ? styles.previewTabActive : ''}`}
          onClick={() => {
            setMode('error');
            setError(null);
          }}
          aria-pressed={mode === 'error'}
        >
          Error state
        </button>
      </div>

      {mode === 'success' ? (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.successIcon}`}
            aria-hidden="true"
          >
            <CheckIcon width={26} height={26} />
          </div>

          <h2 className={styles.title}>
            {isCompleted ? 'Password reset successfully' : 'Reset link verified'}
          </h2>
          <p className={styles.description}>
            {isCompleted
              ? 'Your password has been successfully updated. You can now sign in with your new credentials.'
              : 'Your reset link is verified. Set your new password below.'}
          </p>

          {isCompleted ? (
            <div className={styles.actionRow}>
              <Button href="/auth/sign-in" variant="primary" size="md" fullWidth>
                Sign in to your account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {error && (
                <div
                  className={`${styles.feedbackBanner} ${styles.errorBanner}`}
                  role="alert"
                >
                  {error}
                </div>
              )}

              <TextBox
                id="reset-new-password"
                label="New password"
                name="newPassword"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
                required
              />

              <TextBox
                id="reset-confirm-password"
                label="Confirm password"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
                required
              />

              <div className={styles.actionRow}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating password...' : 'Reset password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className={styles.container}>
          <div
            className={`${styles.iconWrapper} ${styles.errorIcon}`}
            aria-hidden="true"
          >
            <CloseIcon width={26} height={26} />
          </div>

          <h2 className={styles.title}>Reset link expired</h2>
          <p className={styles.description}>
            This password reset link is invalid or has expired. Please request a
            new link to reset your password.
          </p>

          <div className={styles.actionRow}>
            <Button
              href="/auth/forgot-password"
              variant="primary"
              size="md"
              fullWidth
            >
              Request a new link
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
