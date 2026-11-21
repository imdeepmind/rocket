import type {Metadata} from 'next';
import React, {Suspense} from 'react';

import Box from '@/componentsV2/bits/Box';
import VerifyEmailCard from '@/componentsV2/container/auth/VerifyEmailCard';

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
