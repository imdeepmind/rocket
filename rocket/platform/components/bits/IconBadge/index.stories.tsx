import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import ZapIcon from '@/icons/ZapIcon';

import IconBadge from './index';

const meta = {
  title: 'Bits/IconBadge',
  component: IconBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof IconBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryWithIcon: Story = {
  args: {
    icon: <ZapIcon width={22} height={22} />,
    variant: 'primary',
    size: 'lg',
    rounded: 'md',
  },
};

export const SuccessCheckmark: Story = {
  args: {
    children: '✓',
    variant: 'success',
    size: 'sm',
    rounded: 'full',
  },
};

export const StepNumber: Story = {
  args: {
    children: '1',
    variant: 'surface',
    size: 'md',
    rounded: 'full',
  },
};
