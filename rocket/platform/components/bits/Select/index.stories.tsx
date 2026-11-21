import type {Meta, StoryObj} from '@storybook/react';

import Select from './index';

const REGION_OPTIONS = [
  {value: 'us-east-1', label: 'US East (N. Virginia)'},
  {value: 'us-west-2', label: 'US West (Oregon)'},
  {value: 'eu-central-1', label: 'EU Central (Frankfurt)'},
  {value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)'},
];

const meta = {
  title: 'Bits/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    sizeVariant: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options: REGION_OPTIONS,
    defaultValue: 'us-east-1',
    sizeVariant: 'md',
  },
};

export const WithLabelAndHint: Story = {
  args: {
    label: 'Deployment Region',
    hint: 'Select the geographic region closest to your majority users.',
    options: REGION_OPTIONS,
    defaultValue: 'us-east-1',
    fullWidth: true,
  },
};

export const ErrorState: Story = {
  args: {
    label: 'Target Database Tier',
    error: 'Selected region is currently at maximum capacity.',
    options: [
      {value: 'free', label: 'Hobby Shared (PostgreSQL)'},
      {value: 'pro', label: 'Dedicated Pro (PostgreSQL)', disabled: true},
    ],
    defaultValue: 'pro',
    fullWidth: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Caching Engine',
    options: [{value: 'redis', label: 'Redis 7.2 (Managed)'}],
    disabled: true,
    hint: 'Managed automatically by Rocket',
    fullWidth: true,
  },
};
