import type {Meta, StoryObj} from '@storybook/react';

import SignUpCard from './index';

const meta = {
  title: 'Container/Auth/SignUpCard',
  component: SignUpCard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SignUpCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: data => alert(`Sign up submitted: ${data.name} - ${data.email}`),
    onOAuthClick: provider => alert(`OAuth: ${provider}`),
  },
};

export const Submitting: Story = {
  args: {
    onSubmit: () => {},
    isSubmitting: true,
  },
};

export const WithError: Story = {
  args: {
    onSubmit: () => {},
    error: 'An account with this email already exists.',
  },
};
