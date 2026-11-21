import type {Metadata} from 'next';
import React from 'react';

import SignInCard from '@/componentsV2/container/auth/SignInCard';

export const metadata: Metadata = {
  title: 'Sign In · Rocket',
  description: 'Sign in to deploy and manage your backends on Rocket.',
};

export default function SignInPage(): React.JSX.Element {
  return <SignInCard />;
}
