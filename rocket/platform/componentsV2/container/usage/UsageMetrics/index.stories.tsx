import type {Meta, StoryObj} from '@storybook/react';

import UsageMetrics, {type UsageMetricsProps} from './index';

const meta = {
  title: 'Container/Usage/UsageMetrics',
  component: UsageMetrics,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<UsageMetricsProps>;

export default meta;
type Story = StoryObj<UsageMetricsProps>;

export const Default: Story = {
  args: {},
};
