import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Section from '@/componentsV2/bits/Section';
import StatusDot from '@/componentsV2/bits/StatusDot';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface PreviewProject {
  name: string;
  status: 'Live' | 'Failed';
  deployed: string;
  endpoint: string;
}

export interface RecentActivity {
  id: string;
  title: string;
  meta: string;
  statusVariant: 'success' | 'warning' | 'error';
}

export const DEFAULT_PREVIEW_PROJECTS: PreviewProject[] = [
  {
    name: 'product-api',
    status: 'Live',
    deployed: '2h ago',
    endpoint: 'api.rocket.dev/product',
  },
  {
    name: 'analytics-service',
    status: 'Live',
    deployed: '3h ago',
    endpoint: 'api.rocket.dev/analytics',
  },
  {
    name: 'blog-backend',
    status: 'Failed',
    deployed: '1d ago',
    endpoint: 'api.rocket.dev/blog',
  },
];

export const DEFAULT_RECENT_ACTIVITIES: RecentActivity[] = [
  {
    id: '1',
    title: 'Deployment succeeded',
    meta: 'product-api · 2h ago',
    statusVariant: 'success',
  },
  {
    id: '2',
    title: 'Deployment in progress',
    meta: 'analytics-service · 3h ago',
    statusVariant: 'warning',
  },
  {
    id: '3',
    title: 'Deployment failed',
    meta: 'blog-backend · 1d ago',
    statusVariant: 'error',
  },
];

export interface ProjectsPreviewProps {
  title?: string;
  subtitle?: string;
  newProjectHref?: string;
  projects?: PreviewProject[];
  recentActivities?: RecentActivity[];
  classNameOverride?: string;
}

export default function ProjectsPreview({
  title = 'Projects',
  subtitle = 'Your deployed backend services',
  newProjectHref = '/auth/sign-in',
  projects = DEFAULT_PREVIEW_PROJECTS,
  recentActivities = DEFAULT_RECENT_ACTIVITIES,
  classNameOverride,
}: ProjectsPreviewProps): React.JSX.Element {
  return (
    <Section
      container="landing"
      pt="16"
      pb="16"
      classNameOverride={classNameOverride}
    >
      <Card
        variant="glass"
        radius="2xl"
        padding="none"
        fullWidth
        classNameOverride={styles.dashboardCard}
      >
        {/* Left: Projects list */}
        <Box classNameOverride={styles.projectsCol}>
          <Flex
            align="center"
            justify="between"
            mb="7"
            wrap="wrap"
            gap="3"
            fullWidth
          >
            <Flex direction="column" gap="1">
              <Typography variant="h2" as="h3">
                {title}
              </Typography>
              <Typography variant="caption" color="muted">
                {subtitle}
              </Typography>
            </Flex>
            <Button href={newProjectHref} size="sm" variant="primary">
              + New project
            </Button>
          </Flex>

          <Box classNameOverride={styles.tableWrapper}>
            <Box classNameOverride={styles.table}>
              <Box classNameOverride={styles.tableHeader}>
                <Typography variant="caption" color="muted">
                  Project
                </Typography>
                <Typography variant="caption" color="muted">
                  Status
                </Typography>
                <Typography variant="caption" color="muted">
                  Deployed
                </Typography>
                <Typography variant="caption" color="muted">
                  Endpoint
                </Typography>
              </Box>
              {projects.map(project => (
                <Box key={project.name} classNameOverride={styles.tr}>
                  <Typography variant="mono" color="white" weight="medium">
                    {project.name}
                  </Typography>
                  <Typography
                    variant="mono"
                    color={project.status === 'Live' ? 'success' : 'error'}
                    weight="medium"
                  >
                    {project.status === 'Live' ? '● Live' : '▲ Failed'}
                  </Typography>
                  <Typography variant="caption" color="muted">
                    {project.deployed}
                  </Typography>
                  <Typography variant="caption" color="muted">
                    {project.endpoint}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right: Recent activity */}
        <Box classNameOverride={styles.activityCol}>
          <Box mb="6">
            <Typography
              variant="h4"
              as="h3"
              color="secondary"
              weight="semibold"
            >
              Recent activity
            </Typography>
          </Box>
          <Flex direction="column" gap="5">
            {recentActivities.map(item => (
              <Box key={item.id}>
                <Flex align="center" gap="2">
                  <StatusDot variant={item.statusVariant} size="sm" />
                  <Typography variant="body-lg" color="white" weight="medium">
                    {item.title}
                  </Typography>
                </Flex>
                <Typography
                  variant="caption"
                  color="muted"
                  classNameOverride={styles.activityMeta}
                >
                  {item.meta}
                </Typography>
              </Box>
            ))}
          </Flex>
        </Box>
      </Card>
    </Section>
  );
}
