'use client';

import React, {useState} from 'react';

import AppNavbar from '@/componentsV2/container/navigation/AppNavbar';
import AppSidebar from '@/componentsV2/container/navigation/AppSidebar';

import styles from './styles.module.css';

export interface AppShellProps {
  navbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
  children: React.ReactNode;
  classNameOverride?: string;
}

export default function AppShell({
  navbar,
  sidebar,
  isSidebarOpen: controlledIsOpen,
  onToggleSidebar: controlledOnToggle,
  onCloseSidebar: controlledOnClose,
  children,
  classNameOverride,
}: AppShellProps): React.JSX.Element {
  const [internalIsOpen, setInternalIsOpen] = useState(true);

  const isSidebarOpen = controlledIsOpen ?? internalIsOpen;
  const toggleSidebar =
    controlledOnToggle ?? (() => setInternalIsOpen(prev => !prev));
  const closeSidebar = controlledOnClose ?? (() => setInternalIsOpen(false));

  const combinedClass = classNameOverride ?? styles.shell;

  return (
    <div className={combinedClass}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className={styles.backdrop}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {sidebar ?? (
        <AppSidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onClose={closeSidebar}
        />
      )}

      {/* Main Viewport */}
      <div className={styles.viewport}>
        {navbar ?? (
          <AppNavbar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
        )}
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
