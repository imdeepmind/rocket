'use client';

import Link from 'next/link';
import React, {useState} from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import AuthShell from '@/componentsV2/container/auth/AuthShell';

import styles from './styles.module.css';

export interface ResetPasswordCardProps {
  mode?: 'success' | 'error';
  onSubmit: (newPassword: string, confirmPassword: string) => void;
  isSubmitting?: boolean;
  isCompleted?: boolean;
  error?: string | null;
  signInHref?: string;
  classNameOverride?: string;
}

export default function ResetPasswordCard({
  mode = 'success',
  onSubmit,
  isSubmitting = false,
  isCompleted = false,
  error,
  signInHref = '/auth/sign-in',
  classNameOverride,
}: ResetPasswordCardProps): React.JSX.Element {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(newPassword, confirmPassword);
  }

  const footer = (
    <Link href={signInHref} className={styles.backLink}>
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
      classNameOverride={classNameOverride}
    >
      {mode === 'success' ? (
        <div className={styles.container}>
          <div className={styles.iconCircle}>
            <CheckIcon width={24} height={24} />
          </div>

          <Typography
            variant="h3"
            as="h2"
            classNameOverride={styles.statusTitle}
          >
            {isCompleted
              ? 'Password reset successfully'
              : 'Reset link verified'}
          </Typography>

          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.statusDesc}
          >
            {isCompleted
              ? 'Your password has been successfully updated. You can now sign in with your new credentials.'
              : 'Your reset link is verified. Set your new password below.'}
          </Typography>

          {isCompleted ? (
            <div className={styles.actionRow}>
              <Button href={signInHref} variant="primary" size="md" fullWidth>
                Sign in to your account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {error && <Alert variant="error" message={error} />}

              <TextBox
                id="new-password"
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                fullWidth
                required
              />

              <TextBox
                id="confirm-password"
                label="Confirm new password"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                fullWidth
                required
              />

              <div className={styles.actionRow}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating password...' : 'Update password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className={styles.container}>
          <div className={[styles.iconCircle, styles.errorCircle].join(' ')}>
            <CloseIcon width={24} height={24} />
          </div>

          <Typography
            variant="h3"
            as="h2"
            classNameOverride={styles.statusTitle}
          >
            Invalid or expired link
          </Typography>

          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.statusDesc}
          >
            This password reset link is invalid or has expired. Please request a
            new one.
          </Typography>

          <div className={styles.actionRow}>
            <Button
              href="/auth/forgot-password"
              variant="primary"
              size="md"
              fullWidth
            >
              Request a new reset link
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
