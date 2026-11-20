'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useState} from 'react';

import AuthShell from '@/app/container/auth/AuthShell';
import OAuthButtons from '@/app/container/auth/OAuthButtons';

import Button from '@/app/components/bits/Button';
import TextBox from '@/app/components/bits/TextBox';

import {signUpWithEmail} from '@/app/lib/auth';

import styles from './styles.module.css';

export default function SignUp(): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    setIsSubmitting(true);
    const result = await signUpWithEmail({name, email, password});
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
          id="signup-name"
          label="Name"
          name="name"
          type="text"
          placeholder="Alex Doe"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          autoComplete="name"
          required
        />

        <TextBox
          id="signup-email"
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
          id="signup-password"
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
