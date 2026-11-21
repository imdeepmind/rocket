import React from 'react';

import ActivityIcon from '@/icons/ActivityIcon';

import Card from '@/componentsV2/bits/Card';
import ProgressBar from '@/componentsV2/bits/ProgressBar';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface UsageStatItem {
  title: string;
  value: string;
  percent: number;
  unit: string;
}

export interface ResourceDistributionItem {
  serviceName: string;
  environment: string;
  usageSummary: string;
}

export interface UsageMetricsProps {
  stats: UsageStatItem[];
  distributions?: ResourceDistributionItem[];
  classNameOverride?: string;
}

const DEFAULT_DISTRIBUTIONS: ResourceDistributionItem[] = [
  {
    serviceName: 'blog-backend',
    environment: 'Production',
    usageSummary: '8.4k requests · 2.8 GB',
  },
  {
    serviceName: 'survey-api',
    environment: 'Staging',
    usageSummary: '3.1k requests · 1.1 GB',
  },
  {
    serviceName: 'analytics-service',
    environment: 'Paused',
    usageSummary: '1.0k requests · 0.3 GB',
  },
];

export default function UsageMetrics({
  stats,
  distributions = DEFAULT_DISTRIBUTIONS,
  classNameOverride,
}: UsageMetricsProps): React.JSX.Element {
  const containerClass = [styles.container, classNameOverride]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      {/* 4 Usage Quota Cards */}
      <div className={styles.grid}>
        {stats.map(stat => (
          <Card
            key={stat.title}
            padding="md"
            classNameOverride={styles.statCard}
          >
            <div className={styles.statTopRow}>
              <Typography variant="body-sm" color="muted">
                {stat.title}
              </Typography>
              <div className={styles.iconCircle}>
                <ActivityIcon width={15} height={15} stroke="currentColor" />
              </div>
            </div>

            <div className={styles.statValue}>{stat.value}</div>

            <div className={styles.progressWrapper}>
              <ProgressBar value={stat.percent} size="sm" variant="primary" />
            </div>

            <Typography variant="caption" color="muted">
              {stat.unit}
            </Typography>
          </Card>
        ))}
      </div>

      {/* Resource Breakdown Card */}
      <Card padding="lg" classNameOverride={styles.breakdownCard}>
        <div className={styles.breakdownHeader}>
          <Typography variant="h3">Active Resource Distribution</Typography>
          <Typography variant="body-sm" color="muted">
            Resource allocation across all running services in your current
            billing cycle.
          </Typography>
        </div>

        <div className={styles.distributionList}>
          {distributions.map((item, idx) => (
            <div key={idx} className={styles.distributionRow}>
              <div className={styles.distributionLeft}>
                <span className={styles.distributionName}>
                  {item.serviceName}
                </span>
                <span className={styles.distributionEnv}>
                  ({item.environment})
                </span>
              </div>
              <span className={styles.distributionSummary}>
                {item.usageSummary}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
