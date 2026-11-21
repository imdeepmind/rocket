import type {Meta, StoryObj} from '@storybook/react';

import UsageMetrics, {
  type UsageMetricsProps,
  type UsageStatItem,
} from '@/componentsV2/container/dashboard/UsageMetrics';

const SAMPLE_STATS: UsageStatItem[] = [
  {
    title: 'Monthly Requests',
    value: '12.5k / 100k',
    percent: 12.5,
    unit: '12.5% used',
  },
  {
    title: 'Egress Bandwidth',
    value: '4.2 GB / 50 GB',
    percent: 8.4,
    unit: '8.4% used',
  },
  {
    title: 'Compute Execution',
    value: '18m / 300m',
    percent: 6.0,
    unit: '6% used',
  },
  {
    title: 'Database Storage',
    value: '142 MB / 1 GB',
    percent: 14.2,
    unit: '14.2% used',
  },
];

const meta = {
  title: 'Container/Dashboard/UsageMetrics',
  component: UsageMetrics,
  parameters: {
    layout: 'padded',
  },
  args: {
    stats: SAMPLE_STATS,
  },
} satisfies Meta<UsageMetricsProps>;

export default meta;
type Story = StoryObj<UsageMetricsProps>;

export const Default: Story = {};

export const HighUtilization: Story = {
  args: {
    stats: [
      {
        title: 'Monthly Requests',
        value: '94.2k / 100k',
        percent: 94.2,
        unit: '94.2% used (Near limit)',
      },
      {
        title: 'Egress Bandwidth',
        value: '46.8 GB / 50 GB',
        percent: 93.6,
        unit: '93.6% used (Near limit)',
      },
      {
        title: 'Compute Execution',
        value: '280m / 300m',
        percent: 93.3,
        unit: '93.3% used',
      },
      {
        title: 'Database Storage',
        value: '890 MB / 1 GB',
        percent: 89.0,
        unit: '89% used',
      },
    ],
  },
};
