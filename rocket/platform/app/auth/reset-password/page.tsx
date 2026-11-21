import type {Metadata} from 'next';
import React, {Suspense} from 'react';

import ResetPassword from '@/container/auth/ResetPassword';

export const metadata: Metadata = {
  title: 'Reset Password · Rocket',
  description: 'Set a new password for your Rocket account.',
};

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080D]" />}>
      <ResetPassword />
    </Suspense>
  );
}
