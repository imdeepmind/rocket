'use client';

import Link from 'next/link';
import React from 'react';

import ProjectsMetrics from '@/container/dashboard/ProjectsMetrics';
import ProjectsTable from '@/container/dashboard/ProjectsTable';

import styles from './styles.module.css';

export default function DashboardPage(): React.JSX.Element {
  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span>Workspace</span>
        <span>/</span>
        <span className={styles.breadcrumbActive}>Projects</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>
            Manage your backend projects and deployments.
          </p>
        </div>

        <Link href="/dashboard/new" className={styles.newProjectBtn}>
          + New project
        </Link>
      </div>

      {/* Metrics Row */}
      <ProjectsMetrics />

      {/* Projects Table */}
      <ProjectsTable />
    </>
  );
}
