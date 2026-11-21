'use client';

import React from 'react';

import Card from '@/components/bits/Card';

import ActivityIcon from '@/icons/ActivityIcon';

import styles from '@/app/dashboard/styles.module.css';

export default function UsagePage(): React.JSX.Element {
  const usageStats = [
    {
      title: 'Monthly Requests',
      value: '12.5k / 100k',
      percent: 12.5,
      unit: '12.5% used',
    },
    {
      title: 'Egress Bandwidth',
      value: '4.2 GB / 50 GB',
      percent: 8.4,
      unit: '8.4% used',
    },
    {
      title: 'Compute Execution',
      value: '18m / 300m',
      percent: 6.0,
      unit: '6% used',
    },
    {
      title: 'Database Storage',
      value: '142 MB / 1 GB',
      percent: 14.2,
      unit: '14.2% used',
    },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span>Workspace</span>
        <span>/</span>
        <span className={styles.breadcrumbActive}>Usage</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Usage & Quotas</h1>
          <p className={styles.subtitle}>
            Monitor monthly requests, bandwidth, and compute consumption.
          </p>
        </div>
      </div>

      {/* Usage Quota Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {usageStats.map(stat => (
          <Card key={stat.title} padding="md">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <span style={{fontSize: '12px', color: '#8F90A6'}}>
                {stat.title}
              </span>
              <ActivityIcon width={16} height={16} stroke="#FF6B85" />
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#F7F7FA',
                marginBottom: '12px',
                fontFamily: 'var(--font-space-grotesk)',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                background: '#1B1C28',
                borderRadius: '9999px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  width: `${stat.percent}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #E11D48 0%, #FF6B85 100%)',
                  borderRadius: '9999px',
                }}
              />
            </div>
            <span style={{fontSize: '11px', color: '#8F90A6'}}>
              {stat.unit}
            </span>
          </Card>
        ))}
      </div>

      {/* Breakdown Card */}
      <Card padding="md">
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '6px',
            color: '#F7F7FA',
          }}
        >
          Active Resource Distribution
        </h3>
        <p style={{fontSize: '13px', color: '#8F90A6', marginBottom: '16px'}}>
          Resource allocation across all running services in your current
          billing cycle.
        </p>

        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <span>blog-backend (Production)</span>
            <span style={{color: '#34D399'}}>8.4k requests · 2.8 GB</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <span>survey-api (Deploying)</span>
            <span style={{color: '#FBBF24'}}>3.1k requests · 1.1 GB</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <span>analytics-service (Paused)</span>
            <span style={{color: '#94A3B8'}}>1.0k requests · 0.3 GB</span>
          </div>
        </div>
      </Card>
    </>
  );
}
