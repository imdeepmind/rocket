'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useState} from 'react';

import AuthShell from '@/app/container/auth/AuthShell';
import OAuthButtons from '@/app/container/auth/OAuthButtons';

import Button from '@/app/components/bits/Button';
import TextBox from '@/app/components/bits/TextBox';

import {signInWithEmail} from '@/app/lib/auth';

import styles from './styles.module.css';

export default function SignIn(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    setIsSubmitting(true);
    const result = await signInWithEmail({email, password});
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push('/');
    router.refresh();
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
      <OAuthButtons dividerText="or continue with email" />

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <div
            className={`${styles.feedbackBanner} ${styles.error}`}
            role="alert"
          >
            {error}
          </div>
        )}

        <TextBox
          id="signin-email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          fullWidth
          autoComplete="email"
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
          onChange={e => setPassword(e.target.value)}
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
