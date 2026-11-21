import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Box from '@/components/bits/Box';
import Typography from '@/components/bits/Typography';

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
      <Box py="5">
        <Typography variant="body">Form content goes here...</Typography>
      </Box>
    ),
    footer: (
      <Typography as="span" variant="body-sm" color="muted">
        New to Rocket?{' '}
        <a href="/auth/sign-up" style={{color: '#ff6b85'}}>
          Create an account
        </a>
      </Typography>
    ),
  },
};
