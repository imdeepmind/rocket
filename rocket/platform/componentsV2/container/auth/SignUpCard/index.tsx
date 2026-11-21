'use client';

import Link from 'next/link';
import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
import TextBox from '@/componentsV2/bits/TextBox';
import AuthShell from '@/componentsV2/container/auth/AuthShell';
import OAuthButtonGroup from '@/componentsV2/items/OAuthButtonGroup';

import styles from './styles.module.css';

export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
}

export interface SignUpCardProps {
  onSubmit: (data: SignUpFormData) => void;
  onOAuthClick?: (provider: 'Google' | 'GitHub') => void;
  isSubmitting?: boolean;
  error?: string | null;
  oauthNotice?: string | null;
  onDismissOAuthNotice?: () => void;
  signInHref?: string;
  classNameOverride?: string;
}

export default function SignUpCard({
  onSubmit,
  onOAuthClick,
  isSubmitting = false,
  error,
  oauthNotice,
  onDismissOAuthNotice,
  signInHref = '/auth/sign-in',
  classNameOverride,
}: SignUpCardProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({name, email, password});
  }

  const footer = (
    <span>
      Already have an account?{' '}
      <Link href={signInHref} className={styles.link}>
        Sign in
      </Link>
    </span>
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start deploying your backend in minutes."
      footer={footer}
      classNameOverride={classNameOverride}
    >
      <OAuthButtonGroup
        dividerText="or continue with email"
        onProviderClick={onOAuthClick}
        notice={oauthNotice}
        onDismissNotice={onDismissOAuthNotice}
      />

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <div className={styles.alertWrapper}>
            <Alert variant="error" message={error} />
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
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
