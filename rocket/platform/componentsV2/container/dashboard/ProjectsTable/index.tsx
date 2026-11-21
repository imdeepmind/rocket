'use client';

import React, {useMemo} from 'react';

import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import EyeIcon from '@/icons/EyeIcon';
import PauseIcon from '@/icons/PauseIcon';
import PencilIcon from '@/icons/PencilIcon';
import PlayIcon from '@/icons/PlayIcon';
import SearchIcon from '@/icons/SearchIcon';
import TrashIcon from '@/icons/TrashIcon';

import Avatar from '@/componentsV2/bits/Avatar';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Tag from '@/componentsV2/bits/Tag';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import ActionMenu, {type ActionMenuItem} from '@/componentsV2/items/ActionMenu';
import Table, {type TableColumn} from '@/componentsV2/items/Table';
import Tabs, {type TabItem} from '@/componentsV2/items/Tabs';

export interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  status: 'Active' | 'Deploying' | 'Paused';
  url: string;
  lastDeployed: string;
  memory: string;
}

export const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'p-1',
    name: 'Blog Backend',
    slug: 'blog-backend',
    status: 'Active',
    url: 'blog-abc123.rocket.app',
    lastDeployed: '2h ago',
    memory: '512 MB',
  },
  {
    id: 'p-2',
    name: 'Survey API',
    slug: 'survey-api',
    status: 'Deploying',
    url: 'survey-def456.rocket.app',
    lastDeployed: 'Just now',
    memory: '256 MB',
  },
  {
    id: 'p-3',
    name: 'E-commerce Microservice',
    slug: 'ecommerce-ms',
    status: 'Paused',
    url: 'shop-xyz789.rocket.app',
    lastDeployed: '3d ago',
    memory: '1 GB',
  },
];

export interface ProjectsTableProps {
  projects?: ProjectItem[];
  activeFilter?: 'All' | 'Active' | 'Deploying' | 'Paused';
  onFilterChange?: (filter: 'All' | 'Active' | 'Deploying' | 'Paused') => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onViewProject?: (project: ProjectItem) => void;
  onEditProject?: (project: ProjectItem) => void;
  onTogglePause?: (project: ProjectItem) => void;
  onDeleteProject?: (id: string) => void;
  newProjectHref?: string;
  classNameOverride?: string;
}

export default function ProjectsTable({
  projects = DEFAULT_PROJECTS,
  activeFilter = 'All',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  onViewProject,
  onEditProject,
  onTogglePause,
  onDeleteProject,
  newProjectHref = '/dashboard/new',
  classNameOverride,
}: ProjectsTableProps): React.JSX.Element {
  const statusCounts = useMemo(() => {
    return {
      all: projects.length,
      active: projects.filter(p => p.status === 'Active').length,
      deploying: projects.filter(p => p.status === 'Deploying').length,
      paused: projects.filter(p => p.status === 'Paused').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesStatus =
        activeFilter === 'All' || project.status === activeFilter;
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.url.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [projects, activeFilter, searchQuery]);

  const columns: TableColumn<ProjectItem>[] = [
    {
      header: 'Project',
      render: project => (
        <Flex align="center" gap="3">
          <Avatar name={project.name} size="md" variant="project" />
          <Flex direction="column">
            <Typography variant="body-sm" weight="semibold">
              {project.name}
            </Typography>
            <Typography variant="caption" color="muted">
              {project.slug}
            </Typography>
          </Flex>
        </Flex>
      ),
    },
    {
      header: 'Status',
      render: project => {
        const variant =
          project.status === 'Active'
            ? 'success'
            : project.status === 'Deploying'
              ? 'warning'
              : 'neutral';
        return <Tag variant={variant}>{project.status}</Tag>;
      },
    },
    {
      header: 'URL',
      render: project => (
        <Flex
          as="a"
          href={`https://${project.url}`}
          target="_blank"
          rel="noopener noreferrer"
          align="center"
          gap="1"
        >
          <Typography variant="body-sm" color="secondary">
            {project.url}
          </Typography>
          <ExternalLinkIcon width={13} height={13} />
        </Flex>
      ),
    },
    {
      header: 'Memory',
      accessor: 'memory',
      render: project => (
        <Typography variant="body-sm" color="muted">
          {project.memory}
        </Typography>
      ),
    },
    {
      header: 'Last deployed',
      accessor: 'lastDeployed',
      render: project => (
        <Typography variant="body-sm" color="muted">
          {project.lastDeployed}
        </Typography>
      ),
    },
    {
      header: '',
      align: 'right',
      render: project => {
        const menuItems: ActionMenuItem[] = [
          {
            id: 'view',
            label: 'View details',
            icon: <EyeIcon width={14} height={14} />,
            onClick: () => onViewProject?.(project),
          },
          {
            id: 'edit',
            label: 'Edit settings',
            icon: <PencilIcon width={14} height={14} />,
            onClick: () => onEditProject?.(project),
          },
          {
            id: 'pause',
            label: project.status === 'Paused' ? 'Resume' : 'Pause',
            icon:
              project.status === 'Paused' ? (
                <PlayIcon width={14} height={14} />
              ) : (
                <PauseIcon width={14} height={14} />
              ),
            onClick: () => onTogglePause?.(project),
          },
          {
            id: 'delete',
            label: 'Delete project',
            danger: true,
            icon: <TrashIcon width={14} height={14} />,
            onClick: () => onDeleteProject?.(project.id),
          },
        ];

        return <ActionMenu items={menuItems} align="right" />;
      },
    },
  ];

  const filterTabs: TabItem[] = [
    {key: 'All', label: 'All', count: statusCounts.all},
    {key: 'Active', label: 'Active', count: statusCounts.active},
    {key: 'Deploying', label: 'Deploying', count: statusCounts.deploying},
    {key: 'Paused', label: 'Paused', count: statusCounts.paused},
  ];

  return (
    <Card padding="none" fullWidth classNameOverride={classNameOverride}>
      {/* Controls Bar: Filter Tabs & Search */}
      <Flex
        justify="between"
        align="center"
        wrap="wrap"
        gap="3"
        px="5"
        py="4"
        borderBottom
      >
        <Tabs
          items={filterTabs}
          activeKey={activeFilter}
          onChange={key =>
            onFilterChange?.(key as 'All' | 'Active' | 'Deploying' | 'Paused')
          }
        />

        <Box minW="0">
          <TextBox
            sizeVariant="sm"
            placeholder="Search projects..."
            leftIcon={<SearchIcon width={14} height={14} />}
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
          />
        </Box>
      </Flex>

      {/* Table Component */}
      <Table
        columns={columns}
        data={filteredProjects}
        keyExtractor={item => item.id}
        emptyText={
          searchQuery
            ? `No projects matching "${searchQuery}"`
            : 'No projects found in this workspace.'
        }
      />

      {/* Empty Call To Action if zero total projects */}
      {projects.length === 0 && (
        <Flex direction="column" align="center" gap="3" p="8">
          <Typography variant="body" color="muted">
            Get started by launching your first backend on Rocket.
          </Typography>
          <Button variant="primary" size="sm" href={newProjectHref}>
            + New project
          </Button>
        </Flex>
      )}
    </Card>
  );
}
