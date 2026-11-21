'use client';

import React from 'react';

import Badge from '@/components/bits/Badge';
import Button from '@/components/bits/Button';
import Card from '@/components/bits/Card';
import Table, {TableColumn} from '@/components/items/Table';

import {CheckIcon, CreditCardIcon} from '@/icons';

import styles from '../styles.module.css';

interface InvoiceRecord {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
}

export default function BillingPage(): React.JSX.Element {
  const invoices: InvoiceRecord[] = [
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

  const columns: TableColumn<InvoiceRecord>[] = [
    {
      header: 'Invoice ID',
      accessor: 'id',
      render: inv => <span style={{fontWeight: 600}}>{inv.id}</span>,
    },
    {
      header: 'Date',
      accessor: 'date',
      render: inv => <span style={{color: '#8F90A6'}}>{inv.date}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: inv => <span style={{fontWeight: 600}}>{inv.amount}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: inv => <Badge variant="active">{inv.status}</Badge>,
    },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span>Workspace</span>
        <span>/</span>
        <span className={styles.breadcrumbActive}>Billing</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Billing & Plans</h1>
          <p className={styles.subtitle}>
            Manage your subscription tier, payment methods, and invoices.
          </p>
        </div>
      </div>

      {/* Plan Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <Card padding="lg">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '14px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#FF6B85',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Current Plan
              </span>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  margin: '4px 0 0',
                  color: '#F7F7FA',
                }}
              >
                Free Tier
              </h2>
            </div>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#F7F7FA',
                fontFamily: 'var(--font-space-grotesk)',
              }}
            >
              $0
              <span style={{fontSize: '14px', color: '#8F90A6'}}>/mo</span>
            </span>
          </div>

          <p style={{fontSize: '13px', color: '#8F90A6', marginBottom: '18px'}}>
            Great for testing, staging APIs, and personal projects.
          </p>

          <ul
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: 0,
              margin: '0 0 20px',
              listStyle: 'none',
              fontSize: '13px',
              color: '#C9C9D9',
            }}
          >
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <CheckIcon width={14} height={14} stroke="#10B981" />
              100,000 monthly requests included
            </li>
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <CheckIcon width={14} height={14} stroke="#10B981" />
              Up to 3 active services
            </li>
            <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <CheckIcon width={14} height={14} stroke="#10B981" />
              Community support via GitHub
            </li>
          </ul>

          <Button variant="primary" size="md">
            Upgrade to Pro ($29/mo)
          </Button>
        </Card>

        <Card padding="lg">
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#8F90A6',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Payment Method
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '16px',
              marginBottom: '16px',
              padding: '16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <CreditCardIcon width={24} height={24} stroke="#8F90A6" />
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <span style={{fontSize: '13px', fontWeight: 600}}>
                No card attached
              </span>
              <span style={{fontSize: '12px', color: '#8F90A6'}}>
                Free tier requires no payment method
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            + Add payment method
          </Button>
        </Card>
      </div>

      {/* Invoice History */}
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#F7F7FA',
          marginBottom: '12px',
        }}
      >
        Invoices
      </h3>
      <Card padding="none">
        <Table
          columns={columns}
          data={invoices}
          keyExtractor={inv => inv.id}
          emptyMessage="No invoices available."
        />
      </Card>
    </>
  );
}
