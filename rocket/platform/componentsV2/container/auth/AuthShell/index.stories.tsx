import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from '@/componentsV2/bits/Typography';

import AuthShell from './index';

const meta = {
  title: 'Container/Auth/AuthShell',
  component: AuthShell,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Welcome back',
    subtitle: 'Sign in to deploy and manage your backends.',
    children: (
      <div style={{padding: '20px 0'}}>
        <Typography variant="body">Form content goes here...</Typography>
      </div>
    ),
    footer: (
      <span>
        New to Rocket?{' '}
        <a href="/auth/sign-up" style={{color: '#ff6b85'}}>
          Create an account
        </a>
      </span>
    ),
  },
};
