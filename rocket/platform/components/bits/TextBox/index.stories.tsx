import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import MailIcon from '@/icons/MailIcon';
import SearchIcon from '@/icons/SearchIcon';

import TextBox from './index';

const meta = {
  title: 'Bits/TextBox',
  component: TextBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    sizeVariant: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof TextBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter project name...',
    sizeVariant: 'md',
  },
};

export const WithLabelAndHint: Story = {
  args: {
    label: 'Email address',
    hint: 'We will send deployment verification links to this address.',
    placeholder: 'alex@company.com',
    type: 'email',
    fullWidth: true,
  },
};

export const WithIcons: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '320px',
      }}
    >
      <TextBox
        label="Search projects"
        placeholder="Filter by name..."
        leftIcon={<SearchIcon width={16} height={16} />}
        fullWidth
      />
      <TextBox
        label="Account Email"
        placeholder="you@domain.com"
        rightIcon={<MailIcon width={16} height={16} />}
        fullWidth
      />
    </div>
  ),
};

export const ErrorState: Story = {
  args: {
    label: 'Password',
    type: 'password',
    defaultValue: '123',
    error: 'Password must be at least 8 characters long.',
    fullWidth: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Environment Key',
    defaultValue: 'DATABASE_URL',
    disabled: true,
    hint: 'Managed automatically by Rocket',
    fullWidth: true,
  },
};
