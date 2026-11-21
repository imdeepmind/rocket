'use client';

import Link from 'next/link';
import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
import TextBox from '@/componentsV2/bits/TextBox';
import AuthShell from '@/componentsV2/container/auth/AuthShell';

import styles from './styles.module.css';

export interface ForgotPasswordCardProps {
  onSubmit: (email: string) => void;
  isSubmitting?: boolean;
  error?: string | null;
  success?: boolean;
  signInHref?: string;
  classNameOverride?: string;
}

export default function ForgotPasswordCard({
  onSubmit,
  isSubmitting = false,
  error,
  success = false,
  signInHref = '/auth/sign-in',
  classNameOverride,
}: ForgotPasswordCardProps): React.JSX.Element {
  const [email, setEmail] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(email);
  }

  const footer = (
    <Link href={signInHref} className={styles.backLink}>
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={footer}
      classNameOverride={classNameOverride}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && <Alert variant="error" message={error} />}

        {success && (
          <Alert
            variant="success"
            message="A reset link has been dispatched to your email address."
          />
        )}

        <TextBox
          id="forgot-email"
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

        <div className={styles.actionRow}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
