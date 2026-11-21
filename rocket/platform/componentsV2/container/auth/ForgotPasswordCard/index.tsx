'use client';

import Link from 'next/link';
import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import TextBox from '@/componentsV2/bits/TextBox';
import AuthShell from '@/componentsV2/container/auth/AuthShell';

import {forgotPassword} from '@/lib/auth/client';

import styles from './styles.module.css';

export interface ForgotPasswordCardProps {
  onSubmit?: (email: string) => void;
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
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalSuccess, setInternalSuccess] = useState(false);
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const displayError = error !== undefined ? error : internalError;
  const displaySuccess = success || internalSuccess;
  const displaySubmitting = isSubmitting || internalSubmitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(email);
      return;
    }

    setInternalError(null);
    setInternalSuccess(false);
    setInternalSubmitting(true);
    const result = await forgotPassword(email);
    setInternalSubmitting(false);

    if (!result.success) {
      setInternalError(result.error);
      return;
    }

    setInternalSuccess(true);
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
      <Flex
        as="form"
        direction="column"
        gap="4"
        onSubmit={handleSubmit}
        fullWidth
        noValidate
      >
        {displayError && <Alert variant="error" message={displayError} />}

        {displaySuccess && (
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

        <Box mt="2" fullWidth>
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={displaySubmitting}
            disabled={displaySubmitting}
          >
            {displaySubmitting ? 'Sending link...' : 'Send reset link'}
          </Button>
        </Box>
      </Flex>
    </AuthShell>
  );
}
