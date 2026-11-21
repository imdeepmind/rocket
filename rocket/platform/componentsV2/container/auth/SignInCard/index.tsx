'use client';

import Link from 'next/link';
import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import AuthShell from '@/componentsV2/container/auth/AuthShell';
import OAuthButtonGroup from '@/componentsV2/items/OAuthButtonGroup';

import styles from './styles.module.css';

export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignInCardProps {
  onSubmit: (data: SignInFormData) => void;
  onOAuthClick?: (provider: 'Google' | 'GitHub') => void;
  isSubmitting?: boolean;
  error?: string | null;
  oauthNotice?: string | null;
  onDismissOAuthNotice?: () => void;
  signUpHref?: string;
  forgotPasswordHref?: string;
  classNameOverride?: string;
}

export default function SignInCard({
  onSubmit,
  onOAuthClick,
  isSubmitting = false,
  error,
  oauthNotice,
  onDismissOAuthNotice,
  signUpHref = '/auth/sign-up',
  forgotPasswordHref = '/auth/forgot-password',
  classNameOverride,
}: SignInCardProps): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({email, password});
  }

  const footer = (
    <Typography as="span" variant="body-sm" color="muted">
      New to Rocket?{' '}
      <Link href={signUpHref} className={styles.link}>
        Create an account
      </Link>
    </Typography>
  );

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to deploy and manage your backends."
      footer={footer}
      classNameOverride={classNameOverride}
    >
      <OAuthButtonGroup
        dividerText="or continue with email"
        onProviderClick={onOAuthClick}
        notice={oauthNotice}
        onDismissNotice={onDismissOAuthNotice}
      />

      <Flex
        as="form"
        direction="column"
        gap="4"
        onSubmit={handleSubmit}
        fullWidth
        noValidate
      >
        {error && (
          <Box mb="1" fullWidth>
            <Alert variant="error" message={error} />
          </Box>
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
            <Link href={forgotPasswordHref} className={styles.link}>
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

        <Box mt="2" fullWidth>
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </Box>
      </Flex>
    </AuthShell>
  );
}
