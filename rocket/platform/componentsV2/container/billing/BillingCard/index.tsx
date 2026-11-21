'use client';

import React from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CreditCardIcon from '@/icons/CreditCardIcon';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';
import Table, {type TableColumn} from '@/componentsV2/items/Table';

export interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
}

export interface BillingCardProps {
  currentPlan?: string;
  planPrice?: string;
  invoices: InvoiceItem[];
  onUpgrade?: () => void;
  classNameOverride?: string;
}

const PLAN_FEATURES = [
  'Up to 3 active microcontainer deployments',
  '512 MB memory allocation per service',
  '100,000 requests / month included',
  'Community support & GitHub issues',
];

export default function BillingCard({
  currentPlan = 'Free Tier',
  planPrice = '$0',
  invoices,
  onUpgrade,
  classNameOverride,
}: BillingCardProps): React.JSX.Element {
  const invoiceColumns: TableColumn<InvoiceItem>[] = [
    {
      header: 'Invoice ID',
      accessor: 'id',
      render: inv => (
        <Typography variant="body-sm" weight="semibold">
          {inv.id}
        </Typography>
      ),
    },
    {
      header: 'Date',
      accessor: 'date',
      render: inv => (
        <Typography variant="body-sm" color="muted">
          {inv.date}
        </Typography>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: inv => (
        <Typography variant="body-sm" weight="semibold">
          {inv.amount}
        </Typography>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: inv => {
        const variant =
          inv.status.toLowerCase() === 'paid' ? 'success' : 'neutral';
        return <Tag variant={variant}>{inv.status}</Tag>;
      },
    },
  ];

  return (
    <Flex
      direction="column"
      gap="6"
      fullWidth
      classNameOverride={classNameOverride}
    >
      {/* Current Plan Overview */}
      <Card padding="lg">
        <Flex justify="between" align="baseline" mb="4">
          <Box>
            <Tag variant="primary">Current Plan</Tag>
            <Box mt="1">
              <Typography variant="h3">{currentPlan}</Typography>
            </Box>
          </Box>
          <Flex align="baseline" gap="1">
            <Typography variant="h1">{planPrice}</Typography>
            <Typography variant="body-sm" color="muted">
              /mo
            </Typography>
          </Flex>
        </Flex>

        <Typography variant="body-sm" color="muted">
          Great for testing, staging APIs, and personal projects.
        </Typography>

        <Flex as="ul" direction="column" gap="2" my="4" p="0" listStyle="none">
          {PLAN_FEATURES.map((feature, idx) => (
            <Flex as="li" key={idx} align="center" gap="3">
              <IconBadge
                variant="success"
                size="sm"
                icon={
                  <CheckIcon width={12} height={12} stroke="currentColor" />
                }
              />
              <Typography variant="body-sm">{feature}</Typography>
            </Flex>
          ))}
        </Flex>

        <Box mt="2">
          <Button
            variant="primary"
            size="md"
            onClick={onUpgrade}
            leftIcon={<CreditCardIcon width={16} height={16} />}
          >
            Upgrade to Pro ($29/mo)
          </Button>
        </Box>
      </Card>

      {/* Invoice History Table */}
      <Card padding="none">
        <Box px="5" py="4" borderBottom>
          <Typography variant="body" weight="semibold">
            Billing History & Invoices
          </Typography>
          <Typography variant="caption" color="muted">
            Past subscription payments and downloadable receipts.
          </Typography>
        </Box>

        <Table
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={item => item.id}
          emptyText="No invoices found for this workspace."
        />
      </Card>
    </Flex>
  );
}
