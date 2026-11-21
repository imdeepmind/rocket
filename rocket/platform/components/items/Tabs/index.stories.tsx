import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import Tabs, {type TabsProps} from './index';

const meta = {
  title: 'Items/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<TabsProps>;

export default meta;
type Story = StoryObj<TabsProps>;

function InteractiveTabs() {
  const [active, setActive] = useState('all');

  return (
    <Tabs
      items={[
        {key: 'all', label: 'All', count: 12},
        {key: 'active', label: 'Active', count: 8},
        {key: 'deploying', label: 'Deploying', count: 1},
        {key: 'paused', label: 'Paused', count: 3},
      ]}
      activeKey={active}
      onChange={setActive}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveTabs />,
};
