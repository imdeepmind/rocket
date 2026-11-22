import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Flex from '@/components/bits/Flex';

import Banner from './index';

const meta = {
  title: 'Bits/Banner',
  component: Banner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['warning', 'primary', 'info', 'success', 'neutral'],
    },
    dismissible: {
      control: 'boolean',
    },
    showDot: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderConstruction: Story = {
  args: {
    text: 'Website under construction, coming soon',
    variant: 'warning',
  },
};

export const WithBadge: Story = {
  args: {
    badge: 'Coming Soon',
    text: 'Website under construction, coming soon',
    variant: 'warning',
  },
};

export const WithAction: Story = {
  args: {
    text: 'Rocket v1.0 beta is launching soon. Join our waitlist for early access.',
    variant: 'primary',
    action: {
      label: 'Get notified',
      href: '#',
    },
    dismissible: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <Flex direction="column" gap="2" fullWidth>
      <Banner
        variant="warning"
        text="Website under construction, coming soon"
      />
      <Banner
        variant="primary"
        text="Major platform updates are rolling out across all clusters."
      />
      <Banner
        variant="info"
        text="Scheduled database maintenance will begin tonight at 02:00 UTC."
      />
      <Banner
        variant="success"
        text="All services are operational with 99.99% uptime."
      />
      <Banner
        variant="neutral"
        text="Check out our open-source framework ROSS on GitHub."
      />
    </Flex>
  ),
};
