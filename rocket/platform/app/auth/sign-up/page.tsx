import type {Metadata} from 'next';

import SignUp from '@/container/auth/SignUp';

export const metadata: Metadata = {
  title: 'Create Account · Rocket',
  description:
    'Create your Rocket account to start deploying your backends in minutes.',
};

export default function SignUpPage(): React.JSX.Element {
  return <SignUp />;
}
