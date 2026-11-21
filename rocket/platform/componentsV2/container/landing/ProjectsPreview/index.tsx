import React from 'react';

import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';
import Table, {TableColumn} from '@/componentsV2/items/Table';

import styles from './styles.module.css';

export interface PreviewProject {
  name: string;
  status: 'Live' | 'Failed';
  deployed: string;
  endpoint: string;
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

export interface ProjectsPreviewProps {
  title?: string;
  subtitle?: string;
  newProjectHref?: string;
  projects?: PreviewProject[];
  classNameOverride?: string;
}

export default function ProjectsPreview({
  title = 'Projects',
  subtitle = 'Your deployed backend services',
  newProjectHref = '/auth/sign-in',
  projects = DEFAULT_PREVIEW_PROJECTS,
  classNameOverride,
}: ProjectsPreviewProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.section;

  const columns: TableColumn<PreviewProject>[] = [
    {
      header: 'Project',
      render: row => (
        <Typography variant="mono" color="white" weight="semibold">
          {row.name}
        </Typography>
      ),
    },
    {
      header: 'Status',
      render: row => (
        <Tag
          variant={row.status === 'Live' ? 'success' : 'error'}
          size="sm"
          dot
        >
          {row.status}
        </Tag>
      ),
    },
    {
      header: 'Deployed',
      render: row => (
        <Typography variant="caption" color="muted">
          {row.deployed}
        </Typography>
      ),
    },
    {
      header: 'Endpoint',
      render: row => (
        <Typography variant="mono" color="secondary">
          {row.endpoint}
        </Typography>
      ),
    },
  ];

  return (
    <section className={combinedClass}>
      <Card padding="lg" variant="glass" className={styles.dashboardCard}>
        <div className={styles.header}>
          <div>
            <Typography variant="h3" as="h3">
              {title}
            </Typography>
            <Typography variant="caption" color="muted">
              {subtitle}
            </Typography>
          </div>
          <Button href={newProjectHref} size="sm" variant="primary">
            + New project
          </Button>
        </div>

        <div className={styles.tableWrapper}>
          <Table<PreviewProject>
            columns={columns}
            data={projects}
            keyExtractor={row => row.name}
          />
        </div>
      </Card>
    </section>
  );
}
