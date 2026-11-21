import type {Meta, StoryObj} from '@storybook/react';

import Tag from './index';

const meta: Meta<typeof Tag> = {
  title: 'Bits/Tag',
  component: Tag,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'error', 'neutral'],
      description: 'Visual color variant of the tag',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the tag',
    },
    dot: {
      control: 'boolean',
      description: 'Whether to show the leading status dot indicator',
    },
    children: {
      control: 'text',
      description: 'Tag content',
    },
    classNameOverride: {
      control: 'text',
      description: 'Escape hatch custom className override',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {
  args: {
    children: 'Tag Label',
    variant: 'default',
    size: 'md',
    dot: false,
  },
};

export const Primary: Story = {
  args: {
    children: 'Primary Tag',
    variant: 'primary',
    size: 'md',
  },
};

export const SuccessWithDot: Story = {
  args: {
    children: 'Active',
    variant: 'success',
    size: 'md',
    dot: true,
  },
};

export const Warning: Story = {
  args: {
    children: 'In Review',
    variant: 'warning',
    size: 'md',
    dot: true,
  },
};

export const ErrorState: Story = {
  args: {
    children: 'Failed',
    variant: 'error',
    size: 'md',
    dot: true,
  },
};

export const Small: Story = {
  args: {
    children: 'Small Tag',
    size: 'sm',
    variant: 'neutral',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Tag',
    size: 'lg',
    variant: 'primary',
  },
};
