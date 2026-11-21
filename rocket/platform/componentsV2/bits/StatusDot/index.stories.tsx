import type {Meta, StoryObj} from '@storybook/react';

import StatusDot from './index';

const meta = {
  title: 'Bits/StatusDot',
  component: StatusDot,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuccessPulse: Story = {
  args: {
    variant: 'success',
    size: 'md',
    pulse: true,
  },
};

export const LoadingSpinner: Story = {
  args: {
    variant: 'loading',
    size: 'lg',
  },
};

export const WaitingDot: Story = {
  args: {
    variant: 'waiting',
    size: 'lg',
  },
};
