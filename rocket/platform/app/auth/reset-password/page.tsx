import type {Metadata} from 'next';
import React, {Suspense} from 'react';

import Box from '@/componentsV2/bits/Box';
import ResetPasswordCard from '@/componentsV2/container/auth/ResetPasswordCard';

export const metadata: Metadata = {
  title: 'Reset Password · Rocket',
  description: 'Set a new password for your Rocket account.',
};

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Box classNameOverride="min-h-screen bg-[#08080D]" />}>
      <ResetPasswordCard />
    </Suspense>
  );
}
