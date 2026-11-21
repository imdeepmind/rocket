import type {Metadata} from 'next';
import React from 'react';

import SignUpCard from '@/components/container/auth/SignUpCard';

export const metadata: Metadata = {
  title: 'Create Account · Rocket',
  description:
    'Create your Rocket account to start deploying your backends in minutes.',
};

export default function SignUpPage(): React.JSX.Element {
  return <SignUpCard />;
}
