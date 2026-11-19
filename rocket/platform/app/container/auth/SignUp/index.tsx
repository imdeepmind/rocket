'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TextBox from '@/app/components/bits/TextBox';
import Button from '@/app/components/bits/Button';
import AuthShell from '../AuthShell';
import OAuthButtons from '../OAuthButtons';
import styles from './styles.module.css';

export default function SignUp(): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please choose a username');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    // UI state simulation for phase 1 design
    setTimeout(() => {
      setIsSubmitting(false);
    }, 800);
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

