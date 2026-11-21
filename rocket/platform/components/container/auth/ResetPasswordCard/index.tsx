'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import React, {useState} from 'react';

import Alert from '@/components/bits/Alert';
import Box from '@/components/bits/Box';
import Button from '@/components/bits/Button';
import Flex from '@/components/bits/Flex';
import TextBox from '@/components/bits/TextBox';
import Typography from '@/components/bits/Typography';
import AuthShell from '@/components/container/auth/AuthShell';

import CheckIcon from '@/icons/CheckIcon';
import CloseIcon from '@/icons/CloseIcon';

import {resetPassword} from '@/lib/auth/client';

import styles from './styles.module.css';

export interface ResetPasswordCardProps {
  mode?: 'success' | 'error';
  onSubmit?: (newPassword: string, confirmPassword: string) => void;
  isSubmitting?: boolean;
  isCompleted?: boolean;
  error?: string | null;
  signInHref?: string;
  classNameOverride?: string;
}

export default function ResetPasswordCard({
  mode: propMode,
  onSubmit,
  isSubmitting = false,
  isCompleted = false,
  error,
  signInHref = '/auth/sign-in',
  classNameOverride,
}: ResetPasswordCardProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const errorParam = searchParams.get('error');

  const hasParamError =
    !token ||
    Boolean(errorParam) ||
    searchParams.get('status') === 'error' ||
    searchParams.get('state') === 'error';

  const resolvedMode = propMode ?? (hasParamError ? 'error' : 'success');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalCompleted, setInternalCompleted] = useState(false);
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const displayError = error !== undefined ? error : internalError;
  const displayCompleted = isCompleted || internalCompleted;
  const displaySubmitting = isSubmitting || internalSubmitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(newPassword, confirmPassword);
      return;
    }

    setInternalError(null);

    if (newPassword !== confirmPassword) {
      setInternalError('Passwords do not match');
      return;
    }

    setInternalSubmitting(true);
    const result = await resetPassword({newPassword, token});
    setInternalSubmitting(false);

    if (!result.success) {
      setInternalError(result.error);
      return;
    }

    setInternalCompleted(true);
  }

  const footer = (
    <Link href={signInHref} className={styles.backLink}>
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title={
        resolvedMode === 'success' ? 'Reset your password' : 'Reset link issue'
      }
      subtitle={
        resolvedMode === 'success'
          ? 'Enter a new password for your Rocket account.'
          : 'There was a problem with your password reset link.'
      }
      footer={footer}
      classNameOverride={classNameOverride}
    >
      {resolvedMode === 'success' ? (
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
              {displayCompleted
                ? 'Password reset successfully'
                : 'Reset link verified'}
            </Typography>
            <Typography variant="body" color="muted" align="center">
              {displayCompleted
                ? 'Your password has been successfully updated. You can now sign in with your new credentials.'
                : 'Your reset link is verified. Set your new password below.'}
            </Typography>
          </Flex>

          {displayCompleted ? (
            <Button href={signInHref} variant="primary" size="md" fullWidth>
              Sign in to your account
            </Button>
          ) : (
            <Flex
              as="form"
              direction="column"
              gap="4"
              onSubmit={handleSubmit}
              fullWidth
              noValidate
            >
              {displayError && <Alert variant="error" message={displayError} />}

              <TextBox
                id="reset-new-password"
                label="New password"
                name="newPassword"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
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
                onChange={e => setConfirmPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
                required
              />

              <Box mt="2" fullWidth>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={displaySubmitting}
                  disabled={displaySubmitting}
                >
                  {displaySubmitting
                    ? 'Updating password...'
                    : 'Reset password'}
                </Button>
              </Box>
            </Flex>
          )}
        </Flex>
      ) : (
        <Flex direction="column" align="center" fullWidth>
          <Flex
            align="center"
            justify="center"
            mb="4"
            classNameOverride={`${styles.iconCircle} ${styles.errorCircle}`}
          >
            <CloseIcon width={24} height={24} />
          </Flex>

          <Flex direction="column" align="center" gap="1" mb="6">
            <Typography variant="h3" as="h2" align="center">
              Invalid or expired link
            </Typography>
            <Typography variant="body" color="muted" align="center">
              This password reset link is invalid or has expired. Request a
              fresh link to continue.
            </Typography>
          </Flex>

          <Flex direction="column" gap="3" fullWidth>
            <Button
              href="/auth/forgot-password"
              variant="primary"
              size="md"
              fullWidth
            >
              Request a new reset link
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
