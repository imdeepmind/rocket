import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';
import RocketIcon from '@/icons/RocketIcon';

import Button from './index';

const meta = {
  title: 'Bits/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'outline'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
    },
    loading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Deploy project',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
    children: 'Explore docs',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    size: 'md',
    children: 'Cancel',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    size: 'md',
    children: 'Delete project',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    size: 'md',
    children: 'Save draft',
  },
};

export const WithIcons: Story = {
  render: () => (
    <div style={{display: 'flex', gap: '12px'}}>
      <Button
        variant="primary"
        leftIcon={<RocketIcon width={16} height={16} />}
      >
        Launch API
      </Button>
      <Button
        variant="secondary"
        rightIcon={<ArrowRightIcon width={16} height={16} />}
      >
        Next step
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Deploying...',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
