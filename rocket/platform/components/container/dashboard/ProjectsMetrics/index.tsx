import React from 'react';

import Box from '@/components/bits/Box';
import Grid from '@/components/bits/Grid';
import MetricCard from '@/components/items/MetricCard';

import ActivityIcon from '@/icons/ActivityIcon';
import LayersIcon from '@/icons/LayersIcon';
import PauseIcon from '@/icons/PauseIcon';
import TrendUpIcon from '@/icons/TrendUpIcon';

import styles from './styles.module.css';

export interface ProjectsMetricsData {
  totalProjects: number;
  active: number;
  paused: number;
  monthlyRequests: string;
  monthlyRequestsTrend?: string;
}

export const DEFAULT_METRICS: ProjectsMetricsData = {
  totalProjects: 3,
  active: 1,
  paused: 1,
  monthlyRequests: '12.5k',
  monthlyRequestsTrend: '↑ 18% vs last month',
};

export interface ProjectsMetricsProps {
  metrics?: ProjectsMetricsData;
  classNameOverride?: string;
}

export default function ProjectsMetrics({
  metrics = DEFAULT_METRICS,
  classNameOverride,
}: ProjectsMetricsProps): React.JSX.Element {
  return (
    <Box mb="6" classNameOverride={classNameOverride}>
      <Grid columns={4} gap="4" classNameOverride={styles.metricsGrid}>
        <MetricCard
          title="Total projects"
          value={metrics.totalProjects}
          subtitle="Across your workspace"
          icon={<LayersIcon width={16} height={16} stroke="currentColor" />}
          iconVariant="purple"
        />

        <MetricCard
          title="Active"
          value={metrics.active}
          subtitle="Serving traffic"
          icon={<ActivityIcon width={16} height={16} stroke="currentColor" />}
          iconVariant="green"
        />

        <MetricCard
          title="Paused"
          value={metrics.paused}
          subtitle="In paused state"
          icon={<PauseIcon width={16} height={16} stroke="currentColor" />}
          iconVariant="amber"
        />

        <MetricCard
          title="Monthly requests"
          value={metrics.monthlyRequests}
          subtitle={metrics.monthlyRequestsTrend ? undefined : 'vs last month'}
          trend={
            metrics.monthlyRequestsTrend
              ? {text: metrics.monthlyRequestsTrend, positive: true}
              : undefined
          }
          icon={<TrendUpIcon width={16} height={16} stroke="currentColor" />}
          iconVariant="pink"
        />
      </Grid>
    </Box>
  );
}
