'use client';

import React from 'react';

import ProjectsMetrics from '@/components/container/dashboard/ProjectsMetrics';
import ProjectsTable from '@/components/container/dashboard/ProjectsTable';

import Box from '@/components/bits/Box';
import Button from '@/components/bits/Button';
import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';
import Breadcrumb from '@/components/items/Breadcrumb';

export default function DashboardPage(): React.JSX.Element {
  return (
    <>
      <Breadcrumb
        items={[
          {label: 'Workspace', href: '/dashboard'},
          {label: 'Projects', active: true},
        ]}
      />

      <Flex justify="between" align="start" wrap="wrap" gap="5" mt="4" mb="7">
        <Flex direction="column" gap="1">
          <Typography variant="h1">Projects</Typography>
          <Typography variant="body" color="muted">
            Manage your backend projects and deployments.
          </Typography>
        </Flex>

        <Button variant="primary" href="/dashboard/new">
          + New project
        </Button>
      </Flex>

      <Box mb="6">
        <ProjectsMetrics />
      </Box>

      <ProjectsTable />
    </>
  );
}
