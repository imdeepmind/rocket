'use client';

import React, {useMemo, useState} from 'react';

import Badge from '@/components/bits/Badge';
import Card from '@/components/bits/Card';
import Table, {TableColumn} from '@/components/items/Table';

import ChevronLeftIcon from '@/icons/ChevronLeftIcon';
import ChevronRightIcon from '@/icons/ChevronRightIcon';
import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import EyeIcon from '@/icons/EyeIcon';
import MoreHorizontalIcon from '@/icons/MoreHorizontalIcon';
import PauseIcon from '@/icons/PauseIcon';
import PencilIcon from '@/icons/PencilIcon';
import PlayIcon from '@/icons/PlayIcon';
import SearchIcon from '@/icons/SearchIcon';
import TrashIcon from '@/icons/TrashIcon';

import styles from './styles.module.css';

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  initial: string;
  status: 'Active' | 'Deploying' | 'Paused';
  url: string;
  lastDeployed: string;
  memory: string;
}

export const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'p-1',
    name: 'Blog Backend',
    slug: 'blog-backend',
    initial: 'B',
    status: 'Active',
    url: 'blog-abc123.rocket.app',
    lastDeployed: '2h ago',
    memory: '512 MB',
  },
  {
    id: 'p-2',
    name: 'Survey API',
    slug: 'survey-api',
    initial: 'S',
    status: 'Deploying',
    url: 'survey-def456.rocket.app',
    lastDeployed: '-',
    memory: '256 MB',
  },
  {
    id: 'p-3',
    name: 'Analytics Service',
    slug: 'analytics-service',
    initial: 'A',
    status: 'Paused',
    url: 'analytics-ghi789.rocket.app',
    lastDeployed: '3d ago',
    memory: '512 MB',
  },
];

export interface ProjectsTableProps {
  projects?: ProjectRecord[];
}

export function ProjectsTable({
  projects = INITIAL_PROJECTS,
}: ProjectsTableProps): React.JSX.Element {
  const [items, setItems] = useState<ProjectRecord[]>(projects);
  const [activeFilter, setActiveFilter] = useState<
    'All' | 'Active' | 'Deploying' | 'Paused'
  >('All');
  const [filterQuery, setFilterQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage] = useState(1);

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
        activeFilter === 'All' || project.status === activeFilter;
      const matchesSearch =
        project.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        project.slug.toLowerCase().includes(filterQuery.toLowerCase()) ||
        project.url.toLowerCase().includes(filterQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, activeFilter, filterQuery]);

  function handleTogglePause(project: ProjectRecord) {
    setItems(prev =>
      prev.map(p => {
        if (p.id !== project.id) return p;
        const newStatus = p.status === 'Paused' ? 'Active' : 'Paused';
        return {...p, status: newStatus};
      }),
    );
    setOpenMenuId(null);
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(p => p.id !== id));
    setOpenMenuId(null);
  }

  // Define columns using the unified Table component
  const columns: TableColumn<ProjectRecord>[] = [
    {
      key: 'project',
      header: 'Project',
      render: project => (
        <div className={styles.projectCell}>
          <div className={styles.projectAvatar}>{project.initial}</div>
          <div className={styles.projectInfo}>
            <span className={styles.projectName}>{project.name}</span>
            <span className={styles.projectSlug}>{project.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: project => {
        const badgeVariant =
          project.status === 'Active'
            ? 'active'
            : project.status === 'Deploying'
              ? 'deploying'
              : 'paused';
        return <Badge variant={badgeVariant}>{project.status}</Badge>;
      },
    },
    {
      key: 'url',
      header: 'URL',
      render: project => (
        <a
          href={`https://${project.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.urlLink}
        >
          {project.url}
          <ExternalLinkIcon className={styles.urlIcon} width={12} height={12} />
        </a>
      ),
    },
    {
      key: 'lastDeployed',
      header: 'Last Deployed',
      accessor: 'lastDeployed',
      className: styles.mutedCell,
    },
    {
      key: 'memory',
      header: 'Memory',
      accessor: 'memory',
      className: styles.mutedCell,
    },
    {
      key: 'actions',
      header: '',
      ariaLabel: 'Actions',
      width: 48,
      align: 'right',
      render: project => {
        const isMenuOpen = openMenuId === project.id;
        const isPaused = project.status === 'Paused';

        return (
          <div className={styles.actionWrapper}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={e => {
                e.stopPropagation();
                setOpenMenuId(isMenuOpen ? null : project.id);
              }}
              aria-label={`Actions for ${project.name}`}
              aria-expanded={isMenuOpen}
            >
              <MoreHorizontalIcon width={16} height={16} />
            </button>

            {isMenuOpen && (
              <div
                className={styles.actionMenu}
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setOpenMenuId(null);
                    window.open(`https://${project.url}`, '_blank');
                  }}
                >
                  <EyeIcon width={14} height={14} />
                  View
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setOpenMenuId(null);
                  }}
                >
                  <PencilIcon width={14} height={14} />
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleTogglePause(project)}
                >
                  {isPaused ? (
                    <>
                      <PlayIcon width={14} height={14} />
                      Unpause
                    </>
                  ) : (
                    <>
                      <PauseIcon width={14} height={14} />
                      Pause
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={[styles.menuItem, styles.menuItemDanger].join(' ')}
                  onClick={() => handleDelete(project.id)}
                >
                  <TrashIcon width={14} height={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card
      padding="none"
      className={styles.container}
      onClick={() => {
        if (openMenuId) setOpenMenuId(null);
      }}
    >
      {/* Filter and Search Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          <button
            type="button"
            className={[
              styles.filterTab,
              activeFilter === 'All' ? styles.filterTabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveFilter('All')}
          >
            All {statusCounts.all}
          </button>
          <button
            type="button"
            className={[
              styles.filterTab,
              activeFilter === 'Active' ? styles.filterTabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveFilter('Active')}
          >
            Active {statusCounts.active}
          </button>
          <button
            type="button"
            className={[
              styles.filterTab,
              activeFilter === 'Deploying' ? styles.filterTabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveFilter('Deploying')}
          >
            Deploying {statusCounts.deploying}
          </button>
          <button
            type="button"
            className={[
              styles.filterTab,
              activeFilter === 'Paused' ? styles.filterTabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveFilter('Paused')}
          >
            Paused {statusCounts.paused}
          </button>
        </div>

        <div className={styles.searchInputWrapper}>
          <SearchIcon className={styles.searchIcon} width={14} height={14} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter projects"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Unified Table */}
      <Table
        columns={columns}
        data={filteredProjects}
        keyExtractor={item => item.id}
        emptyMessage="No projects found matching the filter criteria."
      />

      {/* Footer / Pagination */}
      <div className={styles.footer}>
        <span>
          Showing 1-{filteredProjects.length} of {items.length} projects
        </span>

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon width={14} height={14} />
          </button>
          <button
            type="button"
            className={[styles.pageBtn, styles.pageBtnActive].join(' ')}
          >
            1
          </button>
          <button
            type="button"
            className={styles.pageBtn}
            disabled
            aria-label="Next page"
          >
            <ChevronRightIcon width={14} height={14} />
          </button>
        </div>
      </div>
    </Card>
  );
}

export default ProjectsTable;
