'use client';

import React from 'react';

import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';
import BillingCard, {
  type InvoiceItem,
} from '@/componentsV2/container/billing/BillingCard';
import Breadcrumb from '@/componentsV2/items/Breadcrumb';

const DUMMY_INVOICES: InvoiceItem[] = [
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
];

export default function BillingPage(): React.JSX.Element {
  return (
    <>
      <Breadcrumb
        items={[
          {label: 'Workspace', href: '/dashboard'},
          {label: 'Billing', active: true},
        ]}
      />

      <Flex direction="column" gap="1" mt="4" mb="7">
        <Typography variant="h1">Billing & Plans</Typography>
        <Typography variant="body" color="muted">
          Manage your subscription tier, payment methods, and invoices.
        </Typography>
      </Flex>

      <BillingCard invoices={DUMMY_INVOICES} />
    </>
  );
}
