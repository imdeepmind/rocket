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

export default function SignUp(): React.JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      setError('Please choose a username');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: trimmedUsername,
        username: trimmedUsername,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to create account');
        setIsSubmitting(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during account creation';
      setError(message);
      setIsSubmitting(false);
    }
  }

  const footer = (
    <span>
      Already have an account?{' '}
      <Link href="/auth/sign-in" className={styles.signInLink}>
        Sign in
      </Link>
    </span>
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start deploying your backend in minutes."
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
          id="signup-username"
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
          id="signup-email"
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

        <TextBox
          id="signup-password"
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

