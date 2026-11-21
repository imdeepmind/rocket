import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from './index';

const meta = {
  title: 'Bits/Typography',
  component: Typography,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'hero',
        'h1',
        'h2',
        'h3',
        'h4',
        'lead',
        'body',
        'body-sm',
        'caption',
        'eyebrow',
        'mono',
      ],
    },
    color: {
      control: 'select',
      options: [
        'default',
        'primary',
        'secondary',
        'muted',
        'accent',
        'success',
        'warning',
        'error',
        'white',
      ],
    },
    weight: {
      control: 'select',
      options: ['normal', 'medium', 'semibold', 'bold'],
    },
    align: {
      control: 'select',
      options: ['left', 'center', 'right'],
    },
    truncate: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'body',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
};

export const Hero: Story = {
  args: {
    variant: 'hero',
    children: 'Your backend. Deployed.',
  },
};

export const Heading1: Story = {
  args: {
    variant: 'h1',
    children: 'Manage your projects',
  },
};

export const Eyebrow: Story = {
  args: {
    variant: 'eyebrow',
    children: 'Platform Overview',
  },
};

export const CodeMono: Story = {
  args: {
    variant: 'mono',
    color: 'muted',
    children: 'rocket deploy --project my-app',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '600px',
      }}
    >
      <Typography variant="hero">Hero Heading</Typography>
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="h4">Heading 4</Typography>
      <Typography variant="lead">
        Lead text: A modern config-driven platform designed for rapid backend
        development.
      </Typography>
      <Typography variant="body">
        Body text: Standard typography component ensuring unified hierarchy
        across the entire app.
      </Typography>
      <Typography variant="body-sm" color="secondary">
        Small body: Subtext or descriptive information for cards and forms.
      </Typography>
      <Typography variant="caption" color="muted">
        Caption: 2 hours ago · Deployed successfully
      </Typography>
      <Typography variant="eyebrow">Eyebrow Badge</Typography>
      <Typography variant="mono">
        curl -s https://api.rocket.dev/health
      </Typography>
    </div>
  ),
};
