import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import CloseIcon from '@/icons/CloseIcon';
import MoreHorizontalIcon from '@/icons/MoreHorizontalIcon';
import TrashIcon from '@/icons/TrashIcon';

import IconButton from './index';

const meta = {
  title: 'Bits/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['ghost', 'secondary', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <MoreHorizontalIcon width={18} height={18} />,
    'aria-label': 'More options',
    variant: 'ghost',
    size: 'md',
  },
};

export const Secondary: Story = {
  args: {
    icon: <CloseIcon width={16} height={16} />,
    'aria-label': 'Close dialog',
    variant: 'secondary',
    size: 'md',
  },
};

export const Danger: Story = {
  args: {
    icon: <TrashIcon width={16} height={16} />,
    'aria-label': 'Delete variable',
    variant: 'danger',
    size: 'md',
  },
};

export const AllSizes: Story = {
  args: {
    icon: <MoreHorizontalIcon width={18} height={18} />,
    'aria-label': 'Menu',
  },
  render: () => (
    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
      <IconButton
        icon={<MoreHorizontalIcon width={14} height={14} />}
        aria-label="Small menu"
        size="sm"
      />
      <IconButton
        icon={<MoreHorizontalIcon width={18} height={18} />}
        aria-label="Medium menu"
        size="md"
      />
      <IconButton
        icon={<MoreHorizontalIcon width={22} height={22} />}
        aria-label="Large menu"
        size="lg"
      />
    </div>
  ),
};
