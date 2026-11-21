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
      email: 'abhishek@example.com',
    },
    onLogout: () => alert('Logout clicked'),
  },
  render: args => (
    <div style={{height: '100vh', display: 'flex'}}>
      <AppSidebar {...args} />
    </div>
  ),
};
