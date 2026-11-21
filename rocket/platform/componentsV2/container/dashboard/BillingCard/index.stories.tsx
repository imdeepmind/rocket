import type {Meta, StoryObj} from '@storybook/react';

import BillingCard, {
  type BillingCardProps,
  type InvoiceItem,
} from '@/componentsV2/container/dashboard/BillingCard';

const SAMPLE_INVOICES: InvoiceItem[] = [
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
  title: 'Container/Dashboard/BillingCard',
  component: BillingCard,
  parameters: {
    layout: 'padded',
  },
  args: {
    currentPlan: 'Free Tier',
    planPrice: '$0',
    invoices: SAMPLE_INVOICES,
  },
} satisfies Meta<BillingCardProps>;

export default meta;
type Story = StoryObj<BillingCardProps>;

export const Default: Story = {};

export const ProPlan: Story = {
  args: {
    currentPlan: 'Pro Platform',
    planPrice: '$29',
    invoices: [
      {
        id: 'inv-101',
        date: 'Nov 01, 2026',
        description: 'Pro Tier - Monthly Subscription',
        amount: '$29.00',
        status: 'Paid',
      },
      ...SAMPLE_INVOICES,
    ],
  },
};

export const NoInvoices: Story = {
  args: {
    invoices: [],
  },
};
