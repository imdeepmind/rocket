import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Alert from './index';

const meta = {
  title: 'Bits/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
    dismissible: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ErrorNotice: Story = {
  args: {
    variant: 'error',
    message: 'Invalid credentials. Please verify your email and password.',
  },
  render: args => (
    <div style={{width: '380px'}}>
      <Alert {...args} />
    </div>
  ),
};

export const SuccessNotice: Story = {
  args: {
    variant: 'success',
    title: 'Verification Link Sent',
    message: 'Check your email inbox to verify your Rocket account.',
    dismissible: true,
    onDismiss: () => alert('Dismissed!'),
  },
  render: args => (
    <div style={{width: '380px'}}>
      <Alert {...args} />
    </div>
  ),
};

export const AllAlerts: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '380px',
      }}
    >
      <Alert
        variant="info"
        message="Google sign-in is currently undergoing scheduled maintenance."
      />
      <Alert
        variant="success"
        message="Project successfully deployed in 42s."
      />
      <Alert
        variant="warning"
        message="Workspace memory usage has reached 85%."
      />
      <Alert
        variant="error"
        message="Failed to connect to managed PostgreSQL database."
      />
    </div>
  ),
};
