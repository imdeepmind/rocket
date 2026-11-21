import type {Meta, StoryObj} from '@storybook/react';

import SignInCard from './index';

const meta = {
  title: 'Container/Auth/SignInCard',
  component: SignInCard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SignInCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: data => alert(`Sign in submitted: ${data.email}`),
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
    error: 'Invalid email or password combination.',
  },
};
