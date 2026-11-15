import React from 'react';
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
              <h3 className={styles.title}>Projects</h3>
              <div className={styles.subtitle}>
                Your deployed backend services
              </div>
            </div>
            <a href="#" className={styles.btn}>
              + New project
            </a>
          </div>

          <div className={styles.tableWrapper}>
            <div className={`${styles.mono} ${styles.table}`}>
              <div className={styles.tableHeader}>
                <span>Project</span>
                <span>Status</span>
                <span>Deployed</span>
                <span>Endpoint</span>
              </div>
              {PROJECTS.map((project) => (
                <div key={project.name} className={styles.tr}>
                  <span className={styles.projectName}>{project.name}</span>
                  <span
                    className={
                      project.status === 'Live'
                        ? styles.statusLive
                        : styles.statusFailed
                    }
                  >
                    {project.status === 'Live' ? '● Live' : '▲ Failed'}
                  </span>
                  <span className={styles.mutedText}>{project.deployed}</span>
                  <span className={styles.mutedText}>{project.endpoint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent activity */}
        <div className={styles.activityCol}>
          <h3 className={styles.activityTitle}>Recent activity</h3>
          <div className={styles.activityList}>
            <div className={styles.activityItem}>
              <span style={{ color: '#34D399' }}>●</span> Deployment succeeded
              <div className={styles.activityMeta}>product-api · 2h ago</div>
            </div>
            <div className={styles.activityItem}>
              <span style={{ color: '#FBBF24' }}>●</span> Deployment in progress
              <div className={styles.activityMeta}>analytics-service · 3h ago</div>
            </div>
            <div className={styles.activityItem}>
              <span style={{ color: '#FF8FA3' }}>●</span> Deployment failed
              <div className={styles.activityMeta}>blog-backend · 1d ago</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

