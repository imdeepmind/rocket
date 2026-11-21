import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import ProjectsTable, {
  type ProjectItem,
  type ProjectsTableProps,
} from '@/componentsV2/container/dashboard/ProjectsTable';

const SAMPLE_PROJECTS: ProjectItem[] = [
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
  {
    id: 'p-4',
    name: 'E-commerce Engine',
    slug: 'ecommerce-engine',
    status: 'Active',
    url: 'shop-jkl012.rocket.app',
    lastDeployed: '5m ago',
    memory: '1 GB',
  },
];

const meta = {
  title: 'Container/Dashboard/ProjectsTable',
  component: ProjectsTable,
  parameters: {
    layout: 'padded',
  },
  args: {
    projects: SAMPLE_PROJECTS,
    activeFilter: 'All',
    searchQuery: '',
    newProjectHref: '#',
  },
} satisfies Meta<ProjectsTableProps>;

export default meta;
type Story = StoryObj<ProjectsTableProps>;

function InteractiveProjectsTable(props: Partial<ProjectsTableProps>) {
  const [projects, setProjects] = useState<ProjectItem[]>(
    props.projects || SAMPLE_PROJECTS,
  );
  const [activeFilter, setActiveFilter] = useState<
    'All' | 'Active' | 'Deploying' | 'Paused'
  >('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleTogglePause = (project: ProjectItem) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === project.id
          ? {
              ...p,
              status: p.status === 'Paused' ? 'Active' : 'Paused',
            }
          : p,
      ),
    );
  };

  const handleDelete = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return (
    <ProjectsTable
      projects={projects}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onTogglePause={handleTogglePause}
      onDeleteProject={handleDelete}
      newProjectHref="#"
      {...props}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveProjectsTable />,
};

export const ActiveFiltered: Story = {
  args: {
    projects: SAMPLE_PROJECTS,
    activeFilter: 'Active',
  },
};

export const EmptyState: Story = {
  args: {
    projects: [],
  },
};
