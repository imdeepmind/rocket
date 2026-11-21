import type {Metadata} from 'next';
import React from 'react';

import ForgotPasswordCard from '@/componentsV2/container/auth/ForgotPasswordCard';

export const metadata: Metadata = {
  title: 'Reset Password · Rocket',
  description: 'Reset your password to regain access to your Rocket account.',
};

export default function ForgotPasswordPage(): React.JSX.Element {
  return <ForgotPasswordCard />;
}
