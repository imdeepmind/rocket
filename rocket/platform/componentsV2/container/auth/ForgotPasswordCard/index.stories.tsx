import type {Meta, StoryObj} from '@storybook/react';

import ForgotPasswordCard from './index';

const meta = {
  title: 'Container/Auth/ForgotPasswordCard',
  component: ForgotPasswordCard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ForgotPasswordCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: email => alert(`Reset requested for: ${email}`),
  },
};

export const SuccessSent: Story = {
  args: {
    onSubmit: () => {},
    success: true,
  },
};

export const ErrorState: Story = {
  args: {
    onSubmit: () => {},
    error: 'No account found with this email address.',
  },
};
