import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import ProgressBar from './index';

const meta = {
  title: 'Bits/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: {type: 'range', min: 0, max: 100, step: 1},
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    variant: {
      control: 'select',
      options: ['primary', 'success', 'warning', 'accent'],
    },
    showLabel: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 48,
    size: 'md',
    variant: 'primary',
    showLabel: true,
  },
  render: args => (
    <div style={{width: '320px'}}>
      <ProgressBar {...args} />
    </div>
  ),
};

export const ResourceUsageVariants: Story = {
  args: {
    value: 50,
  },
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '320px',
      }}
    >
      <div>
        <span style={{fontSize: '12px', color: '#9c9cb0'}}>
          Monthly Requests (12.5%)
        </span>
        <ProgressBar value={12.5} size="sm" variant="primary" />
      </div>
      <div>
        <span style={{fontSize: '12px', color: '#9c9cb0'}}>
          Memory Usage (75%)
        </span>
        <ProgressBar value={75} size="sm" variant="warning" />
      </div>
      <div>
        <span style={{fontSize: '12px', color: '#9c9cb0'}}>
          Storage Quota (95%)
        </span>
        <ProgressBar value={95} size="sm" variant="accent" />
      </div>
      <div>
        <span style={{fontSize: '12px', color: '#9c9cb0'}}>
          Health Checks (100%)
        </span>
        <ProgressBar value={100} size="sm" variant="success" />
      </div>
    </div>
  ),
};
