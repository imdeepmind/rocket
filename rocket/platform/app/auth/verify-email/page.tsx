import type {Metadata} from 'next';
import React, {Suspense} from 'react';

import VerifyEmail from '@/container/auth/VerifyEmail';

export const metadata: Metadata = {
  title: 'Verify Email · Rocket',
  description: 'Verify your email address to access your Rocket account.',
};

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080D]" />}>
      <VerifyEmail />
    </Suspense>
  );
}
