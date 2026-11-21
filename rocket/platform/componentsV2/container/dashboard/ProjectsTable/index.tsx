'use client';

import React, {useMemo, useState} from 'react';

import Avatar from '@/componentsV2/bits/Avatar';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconButton from '@/componentsV2/bits/IconButton';
import Tag from '@/componentsV2/bits/Tag';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import ActionMenu, {type ActionMenuItem} from '@/componentsV2/items/ActionMenu';
import Table, {type TableColumn} from '@/componentsV2/items/Table';
import Tabs, {type TabItem} from '@/componentsV2/items/Tabs';

import ChevronLeftIcon from '@/icons/ChevronLeftIcon';
import ChevronRightIcon from '@/icons/ChevronRightIcon';
import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import EyeIcon from '@/icons/EyeIcon';
import PauseIcon from '@/icons/PauseIcon';
import PencilIcon from '@/icons/PencilIcon';
import PlayIcon from '@/icons/PlayIcon';
import SearchIcon from '@/icons/SearchIcon';
import TrashIcon from '@/icons/TrashIcon';

import styles from './styles.module.css';

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
    lastDeployed: '-',
    memory: '256 MB',
  },
  {
    id: 'p-3',
    name: 'Analytics Service',
    slug: 'analytics-service',
    status: 'Paused',
    url: 'analytics-ghi789.rocket.app',
    lastDeployed: '3d ago',
    memory: '512 MB',
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
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onViewProject,
  onEditProject,
  onTogglePause,
  onDeleteProject,
  newProjectHref = '/dashboard/new',
  classNameOverride,
}: ProjectsTableProps): React.JSX.Element {
  const [items, setItems] = useState<ProjectItem[]>(projects);
  const [internalFilter, setInternalFilter] = useState<
    'All' | 'Active' | 'Deploying' | 'Paused'
  >('All');
  const [internalSearch, setInternalSearch] = useState('');

  const currentFilter = activeFilter ?? internalFilter;
  const currentSearch = searchQuery ?? internalSearch;

  const handleFilterChange = (
    filter: 'All' | 'Active' | 'Deploying' | 'Paused',
  ) => {
    setInternalFilter(filter);
    onFilterChange?.(filter);
  };

  const handleSearchChange = (query: string) => {
    setInternalSearch(query);
    onSearchChange?.(query);
  };

  const handleTogglePause = (project: ProjectItem) => {
    setItems(prev =>
      prev.map(p => {
        if (p.id !== project.id) return p;
        const newStatus: 'Active' | 'Paused' =
          p.status === 'Paused' ? 'Active' : 'Paused';
        return {...p, status: newStatus};
      }),
    );
    onTogglePause?.(project);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    onDeleteProject?.(id);
  };

  const statusCounts = useMemo(() => {
    return {
      all: items.length,
      active: items.filter(p => p.status === 'Active').length,
      deploying: items.filter(p => p.status === 'Deploying').length,
      paused: items.filter(p => p.status === 'Paused').length,
    };
  }, [items]);

  const filteredProjects = useMemo(() => {
    return items.filter(project => {
      const matchesStatus =
        currentFilter === 'All' || project.status === currentFilter;
      const matchesSearch =
        project.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
        project.slug.toLowerCase().includes(currentSearch.toLowerCase()) ||
        project.url.toLowerCase().includes(currentSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, currentFilter, currentSearch]);

  const columns: TableColumn<ProjectItem>[] = [
    {
      header: 'PROJECT',
      render: project => (
        <Flex align="center" gap="3">
          <Avatar name={project.name} size="sm" variant="project" />
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
      header: 'STATUS',
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
          <ExternalLinkIcon width={12} height={12} stroke="currentColor" />
        </Flex>
      ),
    },
    {
      header: 'LAST DEPLOYED',
      accessor: 'lastDeployed',
      render: project => (
        <Typography variant="body-sm" color="muted">
          {project.lastDeployed}
        </Typography>
      ),
    },
    {
      header: 'MEMORY',
      accessor: 'memory',
      render: project => (
        <Typography variant="body-sm" color="muted">
          {project.memory}
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
            label: 'View',
            icon: <EyeIcon width={14} height={14} />,
            onClick: () => {
              if (onViewProject) {
                onViewProject(project);
              } else {
                window.open(`https://${project.url}`, '_blank');
              }
            },
          },
          {
            id: 'edit',
            label: 'Edit',
            icon: <PencilIcon width={14} height={14} />,
            onClick: () => onEditProject?.(project),
          },
          {
            id: 'pause',
            label: project.status === 'Paused' ? 'Unpause' : 'Pause',
            icon:
              project.status === 'Paused' ? (
                <PlayIcon width={14} height={14} />
              ) : (
                <PauseIcon width={14} height={14} />
              ),
            onClick: () => handleTogglePause(project),
          },
          {
            id: 'delete',
            label: 'Delete',
            danger: true,
            icon: <TrashIcon width={14} height={14} />,
            onClick: () => handleDelete(project.id),
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
    <Card
      variant="glass"
      radius="2xl"
      padding="none"
      fullWidth
      classNameOverride={classNameOverride}
    >
      {/* Controls Bar: Filter Tabs & Search */}
      <Flex
        justify="between"
        align="center"
        wrap="wrap"
        gap="3"
        px="6"
        py="4"
        borderBottom
      >
        <Tabs
          items={filterTabs}
          activeKey={currentFilter}
          onChange={key =>
            handleFilterChange(key as 'All' | 'Active' | 'Deploying' | 'Paused')
          }
        />

        <Box minW="0" classNameOverride={styles.searchWrapper}>
          <TextBox
            sizeVariant="sm"
            placeholder="Filter projects"
            leftIcon={<SearchIcon width={14} height={14} />}
            value={currentSearch}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </Box>
      </Flex>

      {/* Table Component */}
      <Table
        columns={columns}
        data={filteredProjects}
        keyExtractor={item => item.id}
        emptyText={
          currentSearch
            ? `No projects matching "${currentSearch}"`
            : 'No projects found in this workspace.'
        }
      />

      {/* Empty Call To Action if zero total projects */}
      {items.length === 0 && (
        <Flex direction="column" align="center" gap="3" p="8">
          <Typography variant="body" color="muted">
            Get started by launching your first backend on Rocket.
          </Typography>
          <Button variant="primary" size="sm" href={newProjectHref}>
            + New project
          </Button>
        </Flex>
      )}

      {/* Footer / Pagination */}
      <Flex
        justify="between"
        align="center"
        wrap="wrap"
        gap="3"
        px="6"
        py="4"
        borderTop
      >
        <Typography variant="caption" color="muted">
          Showing 1-{filteredProjects.length} of {items.length} projects
        </Typography>

        <Flex align="center" gap="1">
          <IconButton
            icon={<ChevronLeftIcon width={14} height={14} />}
            aria-label="Previous page"
            size="sm"
            variant="ghost"
            disabled
          />
          <Flex
            as="button"
            type="button"
            align="center"
            justify="center"
            classNameOverride={styles.pageBtnActive}
          >
            <Typography variant="caption" weight="semibold">
              1
            </Typography>
          </Flex>
          <IconButton
            icon={<ChevronRightIcon width={14} height={14} />}
            aria-label="Next page"
            size="sm"
            variant="ghost"
            disabled
          />
        </Flex>
      </Flex>
    </Card>
  );
}
