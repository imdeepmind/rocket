import type {Meta, StoryObj} from '@storybook/react';

import VerifyEmailCard, {
  type VerifyEmailCardProps,
} from '@/componentsV2/container/auth/VerifyEmailCard';

const meta = {
  title: 'Container/Auth/VerifyEmailCard',
  component: VerifyEmailCard,
  parameters: {
    layout: 'centered',
  },
  args: {
    mode: 'pending',
    email: 'alex@example.com',
    error: null,
    isResending: false,
    resendSuccess: false,
    cooldownSeconds: 0,
    signInHref: '#',
    signUpHref: '#',
  },
} satisfies Meta<VerifyEmailCardProps>;

export default meta;
type Story = StoryObj<VerifyEmailCardProps>;

export const Pending: Story = {
  args: {
    mode: 'pending',
    email: 'developer@example.com',
  },
};

export const ResendCooldown: Story = {
  args: {
    mode: 'pending',
    email: 'developer@example.com',
    cooldownSeconds: 42,
  },
};

export const ResendSuccessBanner: Story = {
  args: {
    mode: 'pending',
    email: 'developer@example.com',
    resendSuccess: true,
  },
};

export const Verifying: Story = {
  args: {
    mode: 'verifying',
    email: 'developer@example.com',
  },
};

export const Success: Story = {
  args: {
    mode: 'success',
    email: 'developer@example.com',
  },
};

export const LinkExpiredError: Story = {
  args: {
    mode: 'error',
    error:
      'This verification link has expired. Verification links are valid for 24 hours.',
  },
};
