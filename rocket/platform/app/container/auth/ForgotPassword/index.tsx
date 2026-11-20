'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TextBox from '@/app/components/bits/TextBox';
import Button from '@/app/components/bits/Button';
import { authClient } from '@/app/lib/auth/client';
import AuthShell from '../AuthShell';
import styles from './styles.module.css';

export default function ForgotPassword(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: trimmedEmail,
        redirectTo: '/auth/reset-password',
      });

      if (result.error) {
        setError(result.error.message || 'Failed to dispatch reset link');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setIsSubmitting(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while requesting password reset';
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
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={footer}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <div className={`${styles.feedbackBanner} ${styles.error}`} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div
            className={`${styles.feedbackBanner} ${styles.success}`}
            role="status"
          >
            A reset link has been dispatched to your email address.
          </div>
        )}

        <TextBox
          id="forgot-email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoComplete="email"
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
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

