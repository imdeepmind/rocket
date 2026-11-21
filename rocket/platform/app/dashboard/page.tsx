'use client';

import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';
import ProjectsMetrics from '@/componentsV2/container/dashboard/ProjectsMetrics';
import ProjectsTable from '@/componentsV2/container/dashboard/ProjectsTable';
import Breadcrumb from '@/componentsV2/items/Breadcrumb';

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
