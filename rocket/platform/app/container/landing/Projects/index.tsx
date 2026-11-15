import React from 'react';
import Button from '@/app/components/bits/Button';
import Text from '@/app/components/bits/Text';
import styles from './styles.module.css';

interface ProjectRow {
  name: string;
  status: 'Live' | 'Failed';
  deployed: string;
  endpoint: string;
}

const PROJECTS: ProjectRow[] = [
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

export default function Projects(): React.JSX.Element {
  return (
    <section className={`${styles.w} ${styles.projectsSection}`}>
      <div className={`${styles.glass} ${styles.dashboardCard}`}>
        {/* Left: Projects list */}
        <div className={styles.projectsCol}>
          <div className={styles.projectsHeader}>
            <div>
              <Text as="h3" variant="h3" className={styles.title}>
                Projects
              </Text>
              <Text as="div" variant="caption" color="muted" className={styles.subtitle}>
                Your deployed backend services
              </Text>
            </div>
            <Button href="#" size="md" variant="primary">
              + New project
            </Button>
          </div>

          <div className={styles.tableWrapper}>
            <div className={`${styles.mono} ${styles.table}`}>
              <div className={styles.tableHeader}>
                <Text as="span" variant="caption" color="muted">Project</Text>
                <Text as="span" variant="caption" color="muted">Status</Text>
                <Text as="span" variant="caption" color="muted">Deployed</Text>
                <Text as="span" variant="caption" color="muted">Endpoint</Text>
              </div>
              {PROJECTS.map((project) => (
                <div key={project.name} className={styles.tr}>
                  <Text as="span" variant="mono" color="white" className={styles.projectName}>
                    {project.name}
                  </Text>
                  <span
                    className={
                      project.status === 'Live'
                        ? styles.statusLive
                        : styles.statusFailed
                    }
                  >
                    {project.status === 'Live' ? '● Live' : '▲ Failed'}
                  </span>
                  <Text as="span" variant="caption" color="muted" className={styles.mutedText}>
                    {project.deployed}
                  </Text>
                  <Text as="span" variant="caption" color="muted" className={styles.mutedText}>
                    {project.endpoint}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent activity */}
        <div className={styles.activityCol}>
          <Text as="h3" variant="h3" className={styles.activityTitle}>
            Recent activity
          </Text>
          <div className={styles.activityList}>
            <div className={styles.activityItem}>
              <span style={{ color: '#34D399' }}>●</span> Deployment succeeded
              <Text as="div" variant="caption" color="muted" className={styles.activityMeta}>
                product-api · 2h ago
              </Text>
            </div>
            <div className={styles.activityItem}>
              <span style={{ color: '#FBBF24' }}>●</span> Deployment in progress
              <Text as="div" variant="caption" color="muted" className={styles.activityMeta}>
                analytics-service · 3h ago
              </Text>
            </div>
            <div className={styles.activityItem}>
              <span style={{ color: '#FF8FA3' }}>●</span> Deployment failed
              <Text as="div" variant="caption" color="muted" className={styles.activityMeta}>
                blog-backend · 1d ago
              </Text>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
