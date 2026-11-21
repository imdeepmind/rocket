import type {Meta, StoryObj} from '@storybook/react';

import BillingCard, {type BillingCardProps} from './index';

const sampleInvoices = [
  {
    id: 'inv-001',
    date: 'Nov 01, 2026',
    description: 'Hobby Tier - Monthly Base',
    amount: '$0.00',
    status: 'Paid',
  },
  {
    id: 'inv-002',
    date: 'Oct 01, 2026',
    description: 'Hobby Tier - Monthly Base',
    amount: '$0.00',
    status: 'Paid',
  },
  {
    id: 'inv-003',
    date: 'Sep 01, 2026',
    description: 'Hobby Tier - Monthly Base',
    amount: '$0.00',
    status: 'Paid',
  },
];

const meta = {
  title: 'Container/Billing/BillingCard',
  component: BillingCard,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<BillingCardProps>;

export default meta;
type Story = StoryObj<BillingCardProps>;

export const Default: Story = {
  args: {
    currentPlan: 'Free Tier',
    planPrice: '$0',
    invoices: sampleInvoices,
  },
};
