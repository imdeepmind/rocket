import type {Meta, StoryObj} from '@storybook/react';

import ProjectsMetrics, {
  type ProjectsMetricsProps,
} from '@/componentsV2/container/dashboard/ProjectsMetrics';

const meta = {
  title: 'Container/Dashboard/ProjectsMetrics',
  component: ProjectsMetrics,
  parameters: {
    layout: 'padded',
  },
  args: {
    metrics: {
      totalProjects: 3,
      active: 1,
      paused: 1,
      monthlyRequests: '12.5k',
      monthlyRequestsTrend: '↑ 18% vs last month',
    },
  },
} satisfies Meta<ProjectsMetricsProps>;

export default meta;
type Story = StoryObj<ProjectsMetricsProps>;

export const Default: Story = {};

export const HighActivity: Story = {
  args: {
    metrics: {
      totalProjects: 14,
      active: 12,
      paused: 2,
      monthlyRequests: '1.4M',
      monthlyRequestsTrend: '↑ 34% vs last month',
    },
  },
};

export const ZeroState: Story = {
  args: {
    metrics: {
      totalProjects: 0,
      active: 0,
      paused: 0,
      monthlyRequests: '0',
      monthlyRequestsTrend: '0% vs last month',
    },
  },
};
