import type {Meta, StoryObj} from '@storybook/react';

import AppNavbar from './index';

const meta = {
  title: 'Container/Navigation/AppNavbar',
  component: AppNavbar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppNavbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SidebarOpen: Story = {
  args: {
    isSidebarOpen: true,
  },
};

export const SidebarClosed: Story = {
  args: {
    isSidebarOpen: false,
    onToggleSidebar: () => alert('Toggle sidebar clicked'),
  },
};
