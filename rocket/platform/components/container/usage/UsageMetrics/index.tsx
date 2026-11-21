'use client';

import React from 'react';

import Card from '@/components/bits/Card';
import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';

export interface UsageStatItem {
  title?: string;
  value?: string;
  percent?: number;
  unit?: string;
}

export interface ResourceDistributionItem {
  serviceName?: string;
  environment?: string;
  usageSummary?: string;
}

export interface UsageMetricsProps {
  stats?: UsageStatItem[];
  distributions?: ResourceDistributionItem[];
  classNameOverride?: string;
}

export default function UsageMetrics({
  classNameOverride,
}: UsageMetricsProps): React.JSX.Element {
  return (
    <Card padding="lg" fullWidth classNameOverride={classNameOverride}>
      <Flex direction="column" align="center" justify="center" p="8" gap="2">
        <Typography variant="h3">Usage & Quotas</Typography>
        <Typography variant="body" color="muted" align="center">
          Resource consumption metrics and quotas will be displayed here.
        </Typography>
      </Flex>
    </Card>
  );
}
