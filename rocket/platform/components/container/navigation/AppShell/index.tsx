'use client';

import React, {useState} from 'react';

import Box from '@/components/bits/Box';
import Flex from '@/components/bits/Flex';
import AppNavbar, {
  type NotificationItem,
} from '@/components/container/navigation/AppNavbar';
import AppSidebar, {
  type UsageData,
  type UserProfileData,
} from '@/components/container/navigation/AppSidebar';

import styles from './styles.module.css';

export interface AppShellProps {
  navbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
  projectCount?: number;
  user?: UserProfileData | null;
  usage?: UsageData;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  activeHref?: string;
  notifications?: NotificationItem[];
  onClearNotifications?: () => void;
  docsHref?: string;
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
  usage,
  onLogout,
  isLoggingOut,
  activeHref,
  notifications,
  onClearNotifications,
  docsHref,
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
      {/* Mobile Drawer Backdrop */}
      <Box
        classNameOverride={[
          styles.backdrop,
          isSidebarOpen ? styles.backdropVisible : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      {sidebar ?? (
        <AppSidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onClose={closeSidebar}
          projectCount={projectCount}
          user={user}
          usage={usage}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
          activeHref={activeHref}
        />
      )}

      {/* Main Content View */}
      <Flex
        direction="column"
        flex="1"
        minW="0"
        position="relative"
        classNameOverride={styles.contentWrapper}
      >
        {navbar ?? (
          <AppNavbar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            notifications={notifications}
            onClearNotifications={onClearNotifications}
            docsHref={docsHref}
          />
        )}
        <Box as="main" flex="1" classNameOverride={styles.mainContent}>
          {children}
        </Box>
      </Flex>
    </Box>
  );
}
