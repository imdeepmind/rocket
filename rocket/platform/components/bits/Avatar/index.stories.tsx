import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Avatar from './index';

const meta = {
  title: 'Bits/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    shape: {
      control: 'select',
      options: ['circle', 'rounded'],
    },
    variant: {
      control: 'select',
      options: ['project', 'user'],
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectInitial: Story = {
  args: {
    name: 'Blog Backend',
    variant: 'project',
    size: 'md',
    shape: 'rounded',
  },
};

export const UserAvatar: Story = {
  args: {
    name: 'Abhishek Chatterjee',
    variant: 'user',
    size: 'md',
    shape: 'circle',
  },
};

export const AllSizes: Story = {
  args: {
    name: 'Survey API',
  },
  render: () => (
    <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
      <Avatar name="Survey API" size="sm" />
      <Avatar name="Survey API" size="md" />
      <Avatar name="Survey API" size="lg" />
    </div>
  ),
};
