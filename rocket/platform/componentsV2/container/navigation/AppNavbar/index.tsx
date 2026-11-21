'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {useEffect, useRef, useState} from 'react';

import BellIcon from '@/icons/BellIcon';
import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import SidebarToggleIcon from '@/icons/SidebarToggleIcon';

import IconButton from '@/componentsV2/bits/IconButton';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type?: 'info' | 'success' | 'warning';
}

export const DUMMY_NOTIFICATIONS: NotificationItem[] = [
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

export interface AppNavbarProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  notifications?: NotificationItem[];
  onClearNotifications?: () => void;
  docsHref?: string;
  githubHref?: string;
  classNameOverride?: string;
}

export default function AppNavbar({
  isSidebarOpen = true,
  onToggleSidebar,
  notifications = DUMMY_NOTIFICATIONS,
  onClearNotifications,
  docsHref = '/docs',
  githubHref = 'https://github.com/imdeepmind/rocket',
  classNameOverride,
}: AppNavbarProps): React.JSX.Element {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const combinedClass = classNameOverride ?? styles.navbar;

  return (
    <header className={combinedClass}>
      <div className={styles.leftGroup}>
        {!isSidebarOpen && (
          <>
            {onToggleSidebar && (
              <IconButton
                icon={<SidebarToggleIcon width={18} height={18} />}
                aria-label="Open sidebar"
                size="md"
                variant="ghost"
                onClick={onToggleSidebar}
              />
            )}

            <Link href="/" className={styles.brandLink}>
              <Image
                src="/logo.png"
                alt="Rocket Logo"
                width={28}
                height={28}
                className={styles.brandLogo}
              />
              <Typography variant="body" weight="bold" color="white" as="span">
                Rocket
              </Typography>
            </Link>
          </>
        )}
      </div>

      <div className={styles.rightGroup}>
        {/* Quick External Links */}
        <a
          href={docsHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docLink}
        >
          <Typography variant="body-sm" color="secondary">
            Docs
          </Typography>
          <ExternalLinkIcon width={12} height={12} />
        </a>

        <a
          href={githubHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docLink}
        >
          <Typography variant="body-sm" color="secondary">
            GitHub
          </Typography>
          <ExternalLinkIcon width={12} height={12} />
        </a>

        {/* Notifications Icon and Dropdown */}
        <div className={styles.notifWrapper} ref={notifRef}>
          <div className={styles.notifBtnContainer}>
            <IconButton
              icon={<BellIcon width={18} height={18} />}
              aria-label={`Notifications (${notifications.length})`}
              size="md"
              variant="ghost"
              onClick={() => setIsNotificationsOpen(prev => !prev)}
            />
            {notifications.length > 0 && (
              <span className={styles.badgeCount}>{notifications.length}</span>
            )}
          </div>

          {isNotificationsOpen && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifHeader}>
                <Typography variant="body-sm" weight="semibold">
                  Notifications
                </Typography>
                {notifications.length > 0 && onClearNotifications && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearNotifications();
                      setIsNotificationsOpen(false);
                    }}
                    className={styles.clearBtn}
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <div className={styles.emptyNotifs}>
                    <Typography variant="caption" color="muted">
                      No new notifications
                    </Typography>
                  </div>
                ) : (
                  notifications.map(item => (
                    <div key={item.id} className={styles.notifItem}>
                      <div className={styles.notifTitleRow}>
                        <Tag
                          variant={
                            item.type === 'success'
                              ? 'success'
                              : item.type === 'warning'
                                ? 'warning'
                                : 'primary'
                          }
                          size="sm"
                          dot
                        >
                          {item.title}
                        </Tag>
                        <Typography variant="caption" color="muted">
                          {item.time}
                        </Typography>
                      </div>
                      <Typography variant="caption" color="secondary">
                        {item.description}
                      </Typography>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
