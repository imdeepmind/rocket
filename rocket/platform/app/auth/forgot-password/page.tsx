import type {Metadata} from 'next';

import ForgotPassword from '@/app/container/auth/ForgotPassword';

export const metadata: Metadata = {
  title: 'Reset Password · Rocket',
  description: 'Reset your password to regain access to your Rocket account.',
};

export default function ForgotPasswordPage(): React.JSX.Element {
  return <ForgotPassword />;
}
