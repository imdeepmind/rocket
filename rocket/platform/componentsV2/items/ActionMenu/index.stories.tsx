import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import EyeIcon from '@/icons/EyeIcon';
import PauseIcon from '@/icons/PauseIcon';
import PencilIcon from '@/icons/PencilIcon';
import TrashIcon from '@/icons/TrashIcon';

import ActionMenu from './index';

const meta = {
  title: 'Items/ActionMenu',
  component: ActionMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      {
        id: 'view',
        label: 'View API',
        icon: <EyeIcon width={14} height={14} />,
        onClick: () => alert('View clicked'),
      },
      {
        id: 'edit',
        label: 'Edit Configuration',
        icon: <PencilIcon width={14} height={14} />,
        onClick: () => alert('Edit clicked'),
      },
      {
        id: 'pause',
        label: 'Pause Service',
        icon: <PauseIcon width={14} height={14} />,
        onClick: () => alert('Pause clicked'),
      },
      {
        id: 'delete',
        label: 'Delete Project',
        icon: <TrashIcon width={14} height={14} />,
        danger: true,
        onClick: () => alert('Delete clicked'),
      },
    ],
  },
};
