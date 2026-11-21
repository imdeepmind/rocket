'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {useEffect, useRef, useState} from 'react';

import BellIcon from '@/icons/BellIcon';
import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import SidebarToggleIcon from '@/icons/SidebarToggleIcon';

import styles from './styles.module.css';

export interface AppNavbarProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

interface NotificationItemData {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'success' | 'info' | 'warning';
}

const DUMMY_NOTIFICATIONS: NotificationItemData[] = [
  {
    id: 'n-1',
    title: 'Deployment Successful',
    description: 'blog-backend was deployed to us-east-1.',
    time: '5m ago',
    type: 'success',
  },
  {
    id: 'n-2',
    title: 'SSL Certificate Active',
    description: 'survey-def456.rocket.app is now secure.',
    time: '1h ago',
    type: 'info',
  },
  {
    id: 'n-3',
    title: 'Monthly Usage Alert',
    description: '12.5% of request quota reached this cycle.',
    time: '1d ago',
    type: 'warning',
  },
];

export function AppNavbar({
  isSidebarOpen = true,
  onToggleSidebar,
}: AppNavbarProps): React.JSX.Element {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  function handleClearNotifications() {
    setNotifications([]);
    setIsNotificationsOpen(false);
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.leftGroup}>
        {/* Only show the toggle button and logo when the sidebar is CLOSED */}
        {!isSidebarOpen && (
          <>
            {onToggleSidebar && (
              <button
                type="button"
                className={styles.sidebarToggleBtn}
                onClick={onToggleSidebar}
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <SidebarToggleIcon width={18} height={18} />
              </button>
            )}

            <Link href="/" className={styles.brandLink}>
              <Image
                src="/logo.png"
                alt="Rocket Logo"
                width={28}
                height={28}
                style={{
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '6px',
                }}
              />
              <span className={styles.brandName}>Rocket</span>
            </Link>
          </>
        )}
      </div>

      <div className={styles.rightGroup}>
        {/* Notifications Dropdown */}
        <div className={styles.notificationsWrapper} ref={notifRef}>
          <button
            type="button"
            className={[
              styles.iconButton,
              isNotificationsOpen ? styles.iconButtonActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIsNotificationsOpen(prev => !prev)}
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
          >
            <BellIcon width={16} height={16} />
            {notifications.length > 0 && (
              <span className={styles.notificationDot} aria-hidden="true" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className={styles.notificationsDropdown}>
              <div className={styles.notificationsHeader}>
                <span className={styles.notificationsTitle}>Notifications</span>
                {notifications.length > 0 ? (
                  <span className={styles.notificationsBadge}>
                    {notifications.length} new
                  </span>
                ) : (
                  <span className={styles.notificationsBadge}>All read</span>
                )}
              </div>

              <div className={styles.notificationsList}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 16px',
                      textAlign: 'center',
                      color: '#8F90A6',
                      fontSize: '12px',
                    }}
                  >
                    No new notifications
                  </div>
                ) : (
                  notifications.map(item => (
                    <div key={item.id} className={styles.notificationItem}>
                      <span
                        className={[
                          styles.statusIndicator,
                          item.type === 'success'
                            ? styles.statusSuccess
                            : item.type === 'info'
                              ? styles.statusInfo
                              : styles.statusWarning,
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      <div className={styles.notificationContent}>
                        <span className={styles.notificationText}>
                          {item.title}
                        </span>
                        <span className={styles.notificationDesc}>
                          {item.description}
                        </span>
                        <span className={styles.notificationTime}>
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className={styles.notificationsFooter}>
                  <button
                    type="button"
                    className={styles.markReadBtn}
                    onClick={handleClearNotifications}
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <a
          href="/docs"
          className={styles.docsLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
          <ExternalLinkIcon width={12} height={12} />
        </a>
      </div>
    </header>
  );
}

export default AppNavbar;
