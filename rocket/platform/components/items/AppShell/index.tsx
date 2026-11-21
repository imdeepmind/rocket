'use client';

import React, {useState} from 'react';

import AppNavbar from '@/components/items/AppNavbar';
import AppSidebar from '@/components/items/AppSidebar';

import styles from './styles.module.css';

export interface AppShellProps {
  children: React.ReactNode;
  projectCount?: number;
}

export function AppShell({
  children,
  projectCount = 3,
}: AppShellProps): React.JSX.Element {
  // Single sidebar state: true = open/expanded, false = collapsed/closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  function toggleSidebar() {
    setIsSidebarOpen(prev => !prev);
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className={styles.shell}>
      {/* Mobile Drawer Backdrop */}
      <div
        className={[
          styles.backdrop,
          isSidebarOpen ? styles.backdropVisible : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ONLY ONE Single Sidebar instance */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onClose={closeSidebar}
        projectCount={projectCount}
      />

      {/* Main Content View */}
      <div className={styles.contentWrapper}>
        <AppNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
