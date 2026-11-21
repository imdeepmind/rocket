import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Avatar from '@/components/bits/Avatar';
import Tag from '@/components/bits/Tag';
import Typography from '@/components/bits/Typography';

import Table, {TableColumn, TableProps} from './index';

interface ProjectSample {
  id: string;
  name: string;
  slug: string;
  status: 'Active' | 'Deploying' | 'Paused';
  url: string;
  lastDeployed: string;
}

const SAMPLE_PROJECTS: ProjectSample[] = [
  {
    id: '1',
    name: 'Blog Backend',
    slug: 'blog-backend',
    status: 'Active',
    url: 'blog-backend.rocket.app',
    lastDeployed: '2h ago',
  },
  {
    id: '2',
    name: 'Survey API',
    slug: 'survey-api',
    status: 'Deploying',
    url: 'survey-api.rocket.app',
    lastDeployed: 'Just now',
  },
  {
    id: '3',
    name: 'Analytics Service',
    slug: 'analytics-service',
    status: 'Paused',
    url: 'analytics.rocket.app',
    lastDeployed: '3d ago',
  },
];

const COLUMNS: TableColumn<ProjectSample>[] = [
  {
    header: 'Project',
    render: row => (
      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
        <Avatar name={row.name} size="sm" />
        <div>
          <Typography variant="body-sm" weight="semibold">
            {row.name}
          </Typography>
          <Typography variant="caption" color="muted">
            {row.slug}
          </Typography>
        </div>
      </div>
    ),
  },
  {
    header: 'Status',
    render: row => {
      const variant =
        row.status === 'Active'
          ? 'success'
          : row.status === 'Deploying'
            ? 'primary'
            : 'neutral';
      return (
        <Tag variant={variant} size="sm" dot>
          {row.status}
        </Tag>
      );
    },
  },
  {
    header: 'Endpoint',
    render: row => (
      <Typography variant="mono" color="secondary">
        {row.url}
      </Typography>
    ),
  },
  {
    header: 'Last Deployed',
    accessor: 'lastDeployed',
  },
];

const meta = {
  title: 'Items/Table',
  component: Table,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<TableProps<ProjectSample>>;

export const ProjectsTable: Story = {
  args: {
    columns: COLUMNS,
    data: SAMPLE_PROJECTS,
    keyExtractor: (row: ProjectSample) => row.id,
  },
  render: args => (
    <div style={{width: '720px'}}>
      <Table<ProjectSample>
        columns={args.columns}
        data={args.data}
        keyExtractor={args.keyExtractor}
      />
    </div>
  ),
};

export const EmptyState: Story = {
  args: {
    columns: COLUMNS,
    data: [],
    keyExtractor: (row: ProjectSample) => row.id,
    emptyText:
      "No projects deployed yet. Click '+ New project' to launch your first API.",
  },
  render: args => (
    <div style={{width: '720px'}}>
      <Table<ProjectSample>
        columns={args.columns}
        data={args.data}
        keyExtractor={args.keyExtractor}
        emptyText={args.emptyText}
      />
    </div>
  ),
};
