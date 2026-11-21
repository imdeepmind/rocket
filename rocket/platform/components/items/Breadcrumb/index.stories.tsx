import type {Meta, StoryObj} from '@storybook/react';

import Breadcrumb from './index';

const meta = {
  title: 'Items/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoLevel: Story = {
  args: {
    items: [
      {label: 'Workspace', href: '/dashboard'},
      {label: 'Projects', active: true},
    ],
  },
};

export const ThreeLevel: Story = {
  args: {
    items: [
      {label: 'Workspace', href: '/dashboard'},
      {label: 'Projects', href: '/dashboard'},
      {label: 'New Project', active: true},
    ],
  },
};

export const SettingsBreadcrumb: Story = {
  args: {
    items: [
      {label: 'Workspace', href: '/dashboard'},
      {label: 'Settings', active: true},
    ],
  },
};
