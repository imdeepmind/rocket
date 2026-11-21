import type {Metadata} from 'next';
import React, {Suspense} from 'react';

import VerifyEmailCard from '@/components/container/auth/VerifyEmailCard';

import Box from '@/components/bits/Box';

export const metadata: Metadata = {
  title: 'Verify Email · Rocket',
  description: 'Verify your email address to access your Rocket account.',
};

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Box classNameOverride="min-h-screen bg-[#08080D]" />}>
      <VerifyEmailCard />
    </Suspense>
  );
}
