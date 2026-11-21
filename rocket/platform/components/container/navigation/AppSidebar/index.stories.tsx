import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import AppSidebar from './index';

const meta = {
  title: 'Container/Navigation/AppSidebar',
  component: AppSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    activeHref: '/dashboard',
    projectCount: 3,
    user: {
      name: 'Abhishek Chatterjee',
      email: 'infinityatme@gmail.com',
    },
    usage: {
      used: '12.5k',
      total: '100k',
      percentage: 12.5,
      upgradeHref: '/dashboard/billing',
    },
    onLogout: () => alert('Logout clicked'),
  },
  render: args => (
    <div style={{height: '100vh', display: 'flex'}}>
      <AppSidebar {...args} />
    </div>
  ),
};
