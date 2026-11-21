import React from 'react';

import Card from '@/componentsV2/bits/Card';
import ProgressBar from '@/componentsV2/bits/ProgressBar';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface MetricTrend {
  text: string;
  positive?: boolean;
}

export interface MetricProgress {
  value: number;
  max?: number;
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconVariant?: 'purple' | 'green' | 'amber' | 'pink' | 'primary';
  trend?: MetricTrend;
  progress?: MetricProgress;
  classNameOverride?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconVariant = 'primary',
  trend,
  progress,
  classNameOverride,
  ...props
}: MetricCardProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.metricCard;

  return (
    <Card padding="md" className={combinedClass} {...props}>
      <div className={styles.topRow}>
        <Typography variant="body-sm" color="muted">
          {title}
        </Typography>
        {icon && (
          <div className={[styles.iconBadge, styles[iconVariant]].join(' ')}>
            {icon}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <Typography variant="h2" weight="bold" classNameOverride={styles.value}>
          {value}
        </Typography>

        {progress && (
          <div className={styles.progressWrapper}>
            <ProgressBar
              value={progress.value}
              max={progress.max || 100}
              size="sm"
              variant="primary"
            />
          </div>
        )}

        <div className={styles.bottomRow}>
          {subtitle && (
            <Typography variant="caption" color="muted">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Typography
              variant="caption"
              color={trend.positive ? 'success' : 'error'}
              weight="semibold"
            >
              {trend.text}
            </Typography>
          )}
        </div>
      </div>
    </Card>
  );
}
