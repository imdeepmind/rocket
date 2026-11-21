import type {Meta, StoryObj} from '@storybook/react';

import Navbar from './index';

const meta = {
  title: 'Container/Navigation/Navbar',
  component: Navbar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  args: {
    isLoggedIn: false,
  },
};

export const LoggedIn: Story = {
  args: {
    isLoggedIn: true,
    onLogout: () => alert('Logout clicked'),
  },
};
