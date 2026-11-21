'use client';

import Link from 'next/link';
import React, {useMemo} from 'react';

import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import EyeIcon from '@/icons/EyeIcon';
import PauseIcon from '@/icons/PauseIcon';
import PencilIcon from '@/icons/PencilIcon';
import PlayIcon from '@/icons/PlayIcon';
import SearchIcon from '@/icons/SearchIcon';
import TrashIcon from '@/icons/TrashIcon';

import Avatar from '@/componentsV2/bits/Avatar';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Tag from '@/componentsV2/bits/Tag';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import ActionMenu, {type ActionMenuItem} from '@/componentsV2/items/ActionMenu';
import Table, {type TableColumn} from '@/componentsV2/items/Table';

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

export interface ProjectsTableProps {
  projects: ProjectItem[];
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
  projects,
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
        <div className={styles.projectCell}>
          <Avatar name={project.name} size="md" variant="project" />
          <div className={styles.projectInfo}>
            <span className={styles.projectName}>{project.name}</span>
            <span className={styles.projectSlug}>{project.slug}</span>
          </div>
        </div>
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
        <a
          href={`https://${project.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.urlLink}
        >
          <span>{project.url}</span>
          <ExternalLinkIcon width={13} height={13} />
        </a>
      ),
    },
    {
      header: 'Memory',
      accessor: 'memory',
      render: project => (
        <span className={styles.cellMuted}>{project.memory}</span>
      ),
    },
    {
      header: 'Last deployed',
      accessor: 'lastDeployed',
      render: project => (
        <span className={styles.cellMuted}>{project.lastDeployed}</span>
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

  const filterTabs: Array<{
    key: 'All' | 'Active' | 'Deploying' | 'Paused';
    label: string;
    count: number;
  }> = [
    {key: 'All', label: 'All', count: statusCounts.all},
    {key: 'Active', label: 'Active', count: statusCounts.active},
    {key: 'Deploying', label: 'Deploying', count: statusCounts.deploying},
    {key: 'Paused', label: 'Paused', count: statusCounts.paused},
  ];

  return (
    <Card
      padding="none"
      classNameOverride={[styles.card, classNameOverride]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Controls Bar: Filter Tabs & Search */}
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeFilter === tab.key}
              className={[
                styles.tab,
                activeFilter === tab.key ? styles.tabActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onFilterChange?.(tab.key)}
            >
              <span>{tab.label}</span>
              <span className={styles.tabBadge}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.searchWrapper}>
          <TextBox
            sizeVariant="sm"
            placeholder="Search projects..."
            leftIcon={<SearchIcon width={14} height={14} />}
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>

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
        <div className={styles.emptyCta}>
          <Typography variant="body" color="muted">
            Get started by launching your first backend on Rocket.
          </Typography>
          <Link href={newProjectHref} className={styles.newLink}>
            <Button variant="primary" size="sm">
              + New project
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
