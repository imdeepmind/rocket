'use client';

import React, {useState} from 'react';

import Box from '@/componentsV2/bits/Box';
import AppNavbar from '@/componentsV2/container/navigation/AppNavbar';
import AppSidebar, {
  type UserProfileData,
} from '@/componentsV2/container/navigation/AppSidebar';

import styles from './styles.module.css';

export interface AppShellProps {
  navbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
  projectCount?: number;
  user?: UserProfileData | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  activeHref?: string;
  children: React.ReactNode;
  classNameOverride?: string;
}

export default function AppShell({
  navbar,
  sidebar,
  isSidebarOpen: controlledIsOpen,
  onToggleSidebar: controlledOnToggle,
  onCloseSidebar: controlledOnClose,
  projectCount = 3,
  user,
  onLogout,
  isLoggingOut,
  activeHref,
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
    <Box classNameOverride={combinedClass}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <Box
          classNameOverride={styles.backdrop}
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
          projectCount={projectCount}
          user={user}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
          activeHref={activeHref}
        />
      )}

      {/* Main Viewport */}
      <Box classNameOverride={styles.viewport}>
        {navbar ?? (
          <AppNavbar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
        )}
        <Box as="main" classNameOverride={styles.mainContent}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
