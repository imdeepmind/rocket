'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TextBox from '@/app/components/bits/TextBox';
import Button from '@/app/components/bits/Button';
import { authClient } from '@/app/lib/auth/client';
import AuthShell from '../AuthShell';
import OAuthButtons from '../OAuthButtons';
import styles from './styles.module.css';

export default function SignIn(): React.JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter your username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.signIn.username({
        username: trimmedUsername,
        password,
      });

      if (result.error) {
        setError(result.error.message || 'Invalid username or password');
        setIsSubmitting(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during sign in';
      setError(message);
      setIsSubmitting(false);
    }
  }

  const footer = (
    <span>
      New to Rocket?{' '}
      <Link href="/auth/sign-up" className={styles.forgotLink}>
        Create an account
      </Link>
    </span>
  );

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to deploy and manage your backends."
      footer={footer}
    >
      <OAuthButtons />

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <div className={`${styles.feedbackBanner} ${styles.error}`} role="alert">
            {error}
          </div>
        )}

        <TextBox
          id="signin-username"
          label="Username"
          name="username"
          type="text"
          placeholder="yourname"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          autoComplete="username"
          required
        />

        <TextBox
          id="signin-password"
          label="Password"
          labelRight={
            <Link href="/auth/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
          }
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoComplete="current-password"
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
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

