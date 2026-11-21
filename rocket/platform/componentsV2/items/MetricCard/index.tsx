import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
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
  const combinedClass = classNameOverride
    ? `${styles.metricCard} ${classNameOverride}`
    : styles.metricCard;

  return (
    <Card
      variant="glass"
      radius="2xl"
      padding="md"
      classNameOverride={combinedClass}
      {...props}
    >
      <Flex justify="between" align="center" mb="3">
        <Typography variant="body-sm" color="muted">
          {title}
        </Typography>
        {icon && (
          <Flex
            align="center"
            justify="center"
            classNameOverride={[styles.iconBadge, styles[iconVariant]].join(
              ' ',
            )}
          >
            {icon}
          </Flex>
        )}
      </Flex>

      <Flex direction="column">
        <Typography variant="h1" weight="bold" classNameOverride={styles.value}>
          {value}
        </Typography>

        {progress && (
          <Box my="2">
            <ProgressBar
              value={progress.value}
              max={progress.max || 100}
              size="sm"
              variant="primary"
            />
          </Box>
        )}

        <Flex justify="between" align="center" gap="2" mt="1">
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
        </Flex>
      </Flex>
    </Card>
  );
}
