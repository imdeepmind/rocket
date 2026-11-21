import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import ActivityIcon from '@/icons/ActivityIcon';
import LayersIcon from '@/icons/LayersIcon';
import PauseIcon from '@/icons/PauseIcon';
import TrendUpIcon from '@/icons/TrendUpIcon';

import MetricCard from './index';

const meta = {
  title: 'Items/MetricCard',
  component: MetricCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TotalProjects: Story = {
  args: {
    title: 'Total projects',
    value: 3,
    subtitle: 'Across your workspace',
    icon: <LayersIcon width={16} height={16} />,
    iconVariant: 'purple',
  },
  render: args => (
    <div style={{width: '260px'}}>
      <MetricCard {...args} />
    </div>
  ),
};

export const ActiveServing: Story = {
  args: {
    title: 'Active',
    value: 1,
    subtitle: 'Serving traffic',
    icon: <ActivityIcon width={16} height={16} />,
    iconVariant: 'green',
  },
  render: args => (
    <div style={{width: '260px'}}>
      <MetricCard {...args} />
    </div>
  ),
};

export const MonthlyRequestsWithTrend: Story = {
  args: {
    title: 'Monthly requests',
    value: '12.5k',
    subtitle: '100k quota',
    icon: <TrendUpIcon width={16} height={16} />,
    iconVariant: 'pink',
    trend: {text: '↑ 18% vs last month', positive: true},
    progress: {value: 12.5, max: 100},
  },
  render: args => (
    <div style={{width: '260px'}}>
      <MetricCard {...args} />
    </div>
  ),
};

export const AllMetricCardsGrid: Story = {
  args: {
    title: 'Total projects',
    value: 3,
  },
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        width: '780px',
      }}
    >
      <MetricCard
        title="Total projects"
        value={3}
        subtitle="Across your workspace"
        icon={<LayersIcon width={16} height={16} />}
        iconVariant="purple"
      />
      <MetricCard
        title="Active"
        value={1}
        subtitle="Serving traffic"
        icon={<ActivityIcon width={16} height={16} />}
        iconVariant="green"
      />
      <MetricCard
        title="Paused"
        value={1}
        subtitle="In paused state"
        icon={<PauseIcon width={16} height={16} />}
        iconVariant="amber"
      />
    </div>
  ),
};
