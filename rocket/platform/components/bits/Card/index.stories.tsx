import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from '@/components/bits/Typography';

import Card from './index';

const meta = {
  title: 'Bits/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'glass', 'interactive', 'bordered'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
    padding: 'md',
    children: (
      <div style={{width: '280px'}}>
        <Typography variant="h4">Standard Card</Typography>
        <Typography variant="body-sm" color="muted">
          Used across dashboard metrics, wizard panels, and settings blocks.
        </Typography>
      </div>
    ),
  },
};

export const Glass: Story = {
  args: {
    variant: 'glass',
    padding: 'lg',
    children: (
      <div style={{width: '320px'}}>
        <Typography variant="h3">Glass Card</Typography>
        <Typography variant="body" color="secondary">
          Featuring translucent backdrop blur, ideal for landing page showcases.
        </Typography>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'interactive',
    padding: 'md',
    children: (
      <div style={{width: '280px'}}>
        <Typography variant="h4">Interactive Card</Typography>
        <Typography variant="caption" color="muted">
          Hover over me to see the subtle lift and border transition.
        </Typography>
      </div>
    ),
  },
};
