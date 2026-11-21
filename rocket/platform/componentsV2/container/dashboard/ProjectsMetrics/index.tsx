import React from 'react';

import ActivityIcon from '@/icons/ActivityIcon';
import LayersIcon from '@/icons/LayersIcon';
import PauseIcon from '@/icons/PauseIcon';
import TrendUpIcon from '@/icons/TrendUpIcon';

import MetricCard from '@/componentsV2/items/MetricCard';

import styles from './styles.module.css';

export interface ProjectsMetricsData {
  totalProjects: number;
  active: number;
  paused: number;
  monthlyRequests: string;
  monthlyRequestsTrend?: string;
}

export interface ProjectsMetricsProps {
  metrics: ProjectsMetricsData;
  classNameOverride?: string;
}

export default function ProjectsMetrics({
  metrics,
  classNameOverride,
}: ProjectsMetricsProps): React.JSX.Element {
  const containerClass = [styles.grid, classNameOverride]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
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
    </div>
  );
}
