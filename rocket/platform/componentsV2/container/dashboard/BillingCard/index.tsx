'use client';

import React from 'react';

import CheckIcon from '@/icons/CheckIcon';
import CreditCardIcon from '@/icons/CreditCardIcon';

import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';
import Table, {type TableColumn} from '@/componentsV2/items/Table';

import styles from './styles.module.css';

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
  const containerClass = [styles.container, classNameOverride]
    .filter(Boolean)
    .join(' ');

  const invoiceColumns: TableColumn<InvoiceItem>[] = [
    {
      header: 'Invoice ID',
      accessor: 'id',
      render: inv => <span className={styles.invoiceId}>{inv.id}</span>,
    },
    {
      header: 'Date',
      accessor: 'date',
      render: inv => <span className={styles.cellMuted}>{inv.date}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: inv => <span className={styles.invoiceAmount}>{inv.amount}</span>,
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
    <div className={containerClass}>
      {/* Current Plan Overview */}
      <div className={styles.plansGrid}>
        <Card padding="lg" classNameOverride={styles.planCard}>
          <div className={styles.planTopRow}>
            <div>
              <span className={styles.planBadge}>Current Plan</span>
              <Typography variant="h3">{currentPlan}</Typography>
            </div>
            <div className={styles.planPriceWrapper}>
              <span className={styles.planPrice}>{planPrice}</span>
              <span className={styles.planPricePeriod}>/mo</span>
            </div>
          </div>

          <Typography variant="body-sm" color="muted">
            Great for testing, staging APIs, and personal projects.
          </Typography>

          <ul className={styles.featureList}>
            {PLAN_FEATURES.map((feature, idx) => (
              <li key={idx} className={styles.featureItem}>
                <div className={styles.checkIconWrapper}>
                  <CheckIcon width={14} height={14} stroke="currentColor" />
                </div>
                <Typography variant="body-sm">{feature}</Typography>
              </li>
            ))}
          </ul>

          <div className={styles.planAction}>
            <Button
              variant="primary"
              size="md"
              onClick={onUpgrade}
              leftIcon={<CreditCardIcon width={16} height={16} />}
            >
              Upgrade to Pro ($29/mo)
            </Button>
          </div>
        </Card>
      </div>

      {/* Invoice History Table */}
      <Card padding="none" classNameOverride={styles.invoicesCard}>
        <div className={styles.invoicesHeader}>
          <div>
            <Typography variant="body" weight="semibold">
              Billing History & Invoices
            </Typography>
            <Typography variant="caption" color="muted">
              Past subscription payments and downloadable receipts.
            </Typography>
          </div>
        </div>

        <Table
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={item => item.id}
          emptyText="No invoices found for this workspace."
        />
      </Card>
    </div>
  );
}
