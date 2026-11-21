'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import AuthShell from '@/componentsV2/container/auth/AuthShell';
import OAuthButtonGroup from '@/componentsV2/items/OAuthButtonGroup';

import {signInWithSocial, signUpWithEmail} from '@/lib/auth/client';

import styles from './styles.module.css';

export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
}

export interface SignUpCardProps {
  onSubmit?: (data: SignUpFormData) => void;
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
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [internalNotice, setInternalNotice] = useState<string | null>(null);

  const displayError = error !== undefined ? error : internalError;
  const displaySubmitting = isSubmitting || internalSubmitting;
  const displayNotice =
    oauthNotice !== undefined ? oauthNotice : internalNotice;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({name, email, password});
      return;
    }

    setInternalError(null);
    const trimmedEmail = email.trim();
    setInternalSubmitting(true);
    const result = await signUpWithEmail({
      name,
      email: trimmedEmail,
      password,
    });
    setInternalSubmitting(false);

    if (!result.success) {
      setInternalError(result.error);
      return;
    }

    router.push(`/auth/verify-email?email=${encodeURIComponent(trimmedEmail)}`);
  }

  async function handleOAuth(provider: 'Google' | 'GitHub') {
    if (onOAuthClick) {
      onOAuthClick(provider);
      return;
    }
    setInternalNotice(null);
    const result = await signInWithSocial(provider, '/dashboard');
    if (!result.success && result.error) {
      setInternalNotice(result.error);
    }
  }

  function handleDismissNotice() {
    if (onDismissOAuthNotice) {
      onDismissOAuthNotice();
    } else {
      setInternalNotice(null);
    }
  }

  const footer = (
    <Typography as="span" variant="body-sm" color="muted">
      Already have an account?{' '}
      <Link href={signInHref} className={styles.link}>
        Sign in
      </Link>
    </Typography>
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
        onProviderClick={handleOAuth}
        notice={displayNotice}
        onDismissNotice={handleDismissNotice}
      />

      <Flex
        as="form"
        direction="column"
        gap="4"
        onSubmit={handleSubmit}
        fullWidth
        noValidate
      >
        {displayError && (
          <Box mb="1" fullWidth>
            <Alert variant="error" message={displayError} />
          </Box>
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

        <Box mt="2" fullWidth>
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={displaySubmitting}
            disabled={displaySubmitting}
          >
            {displaySubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </Box>
      </Flex>
    </AuthShell>
  );
}
