import React from 'react';

import Card from '@/components/bits/Card';

import ActivityIcon from '@/icons/ActivityIcon';
import LayersIcon from '@/icons/LayersIcon';
import PauseIcon from '@/icons/PauseIcon';
import TrendUpIcon from '@/icons/TrendUpIcon';

import styles from './styles.module.css';

export interface MetricsData {
  totalProjects: number;
  active: number;
  paused: number;
  monthlyRequests: string;
  monthlyRequestsTrend: string;
}

export interface ProjectsMetricsProps {
  metrics?: MetricsData;
}

export function ProjectsMetrics({
  metrics = {
    totalProjects: 3,
    active: 1,
    paused: 1,
    monthlyRequests: '12.5k',
    monthlyRequestsTrend: '↑ 18% vs last month',
  },
}: ProjectsMetricsProps): React.JSX.Element {
  return (
    <div className={styles.grid}>
      {/* 1. Total Projects */}
      <Card padding="md" className={styles.metricCard}>
        <div className={styles.topRow}>
          <span className={styles.label}>Total projects</span>
          <div className={[styles.iconBadge, styles.badgePurple].join(' ')}>
            <LayersIcon width={16} height={16} stroke="currentColor" />
          </div>
        </div>
        <div className={styles.bottomContent}>
          <span className={styles.value}>{metrics.totalProjects}</span>
          <span className={styles.subtitle}>Across your workspace</span>
        </div>
      </Card>

      {/* 2. Active */}
      <Card padding="md" className={styles.metricCard}>
        <div className={styles.topRow}>
          <span className={styles.label}>Active</span>
          <div className={[styles.iconBadge, styles.badgeGreen].join(' ')}>
            <ActivityIcon width={16} height={16} stroke="currentColor" />
          </div>
        </div>
        <div className={styles.bottomContent}>
          <span className={styles.value}>{metrics.active}</span>
          <span className={styles.subtitle}>Serving traffic</span>
        </div>
      </Card>

      {/* 3. Paused (Previously Deploying) */}
      <Card padding="md" className={styles.metricCard}>
        <div className={styles.topRow}>
          <span className={styles.label}>Paused</span>
          <div className={[styles.iconBadge, styles.badgeAmber].join(' ')}>
            <PauseIcon width={16} height={16} />
          </div>
        </div>
        <div className={styles.bottomContent}>
          <span className={styles.value}>{metrics.paused}</span>
          <span className={styles.subtitle}>In paused state</span>
        </div>
      </Card>

      {/* 4. Monthly Requests */}
      <Card padding="md" className={styles.metricCard}>
        <div className={styles.topRow}>
          <span className={styles.label}>Monthly requests</span>
          <div className={[styles.iconBadge, styles.badgePink].join(' ')}>
            <TrendUpIcon width={16} height={16} />
          </div>
        </div>
        <div className={styles.bottomContent}>
          <span className={styles.value}>{metrics.monthlyRequests}</span>
          <span className={[styles.subtitle, styles.trendPositive].join(' ')}>
            {metrics.monthlyRequestsTrend}
          </span>
        </div>
      </Card>
    </div>
  );
}

export default ProjectsMetrics;
