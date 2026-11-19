import type { Metadata } from 'next';
import SignIn from '@/app/container/auth/SignIn';

export const metadata: Metadata = {
  title: 'Sign In · Rocket',
  description: 'Sign in to deploy and manage your backends on Rocket.',
};

export default function SignInPage(): React.JSX.Element {
  return <SignIn />;
}

