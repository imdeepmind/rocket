'use client';

import React from 'react';

import UsageMetrics from '@/components/container/usage/UsageMetrics';

import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';
import Breadcrumb from '@/components/items/Breadcrumb';

export default function UsagePage(): React.JSX.Element {
  return (
    <>
      <Breadcrumb
        items={[
          {label: 'Workspace', href: '/dashboard'},
          {label: 'Usage', active: true},
        ]}
      />

      <Flex direction="column" gap="1" mt="4" mb="7">
        <Typography variant="h1">Usage & Quotas</Typography>
        <Typography variant="body" color="muted">
          Monitor monthly requests, bandwidth, and compute consumption.
        </Typography>
      </Flex>

      <UsageMetrics />
    </>
  );
}
