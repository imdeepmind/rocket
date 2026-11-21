'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {useEffect, useState} from 'react';

import Box from '@/components/bits/Box';
import Card from '@/components/bits/Card';
import Flex from '@/components/bits/Flex';
import IconButton from '@/components/bits/IconButton';
import StatusDot from '@/components/bits/StatusDot';
import Tag from '@/components/bits/Tag';
import Typography from '@/components/bits/Typography';

import BellIcon from '@/icons/BellIcon';
import ExternalLinkIcon from '@/icons/ExternalLinkIcon';
import SidebarToggleIcon from '@/icons/SidebarToggleIcon';

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
  classNameOverride?: string;
}

export default function AppNavbar({
  isSidebarOpen = true,
  onToggleSidebar,
  notifications: initialNotifications = DUMMY_NOTIFICATIONS,
  onClearNotifications,
  docsHref = '/docs',
  classNameOverride,
}: AppNavbarProps): React.JSX.Element {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('[data-notifications]')) {
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
    onClearNotifications?.();
    setIsNotificationsOpen(false);
  }

  const combinedClass = classNameOverride ?? styles.navbar;

  return (
    <Box as="header" classNameOverride={combinedClass}>
      {/* Left Group */}
      <Flex align="center" gap="3">
        {!isSidebarOpen && (
          <>
            {onToggleSidebar && (
              <IconButton
                icon={<SidebarToggleIcon width={18} height={18} />}
                aria-label="Open sidebar"
                size="md"
                classNameOverride={styles.iconButton}
                onClick={onToggleSidebar}
              />
            )}

            <Flex
              as={Link}
              href="/"
              align="center"
              gap="3"
              classNameOverride={styles.brandLink}
            >
              <Image
                src="/logo.png"
                alt="Rocket Logo"
                width={28}
                height={28}
                className={styles.brandLogo}
              />
              <Typography
                variant="body"
                weight="bold"
                color="white"
                as="span"
                letterSpacing="tight"
              >
                Rocket
              </Typography>
            </Flex>
          </>
        )}
      </Flex>

      {/* Right Group */}
      <Flex align="center" gap="3" position="relative">
        {/* Notifications Dropdown */}
        <Box position="relative" display="inline-flex" data-notifications>
          <IconButton
            icon={<BellIcon width={16} height={16} />}
            aria-label={`Notifications (${notifications.length})`}
            size="md"
            classNameOverride={[
              styles.iconButton,
              isNotificationsOpen ? styles.iconButtonActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIsNotificationsOpen(prev => !prev)}
          />
          {notifications.length > 0 && (
            <Box
              classNameOverride={styles.notificationDot}
              aria-hidden="true"
            />
          )}

          {isNotificationsOpen && (
            <Card
              variant="glass"
              radius="lg"
              padding="none"
              classNameOverride={styles.notifDropdown}
            >
              <Flex justify="between" align="center" px="4" py="3" borderBottom>
                <Typography variant="body-sm" weight="semibold">
                  Notifications
                </Typography>
                <Tag
                  size="sm"
                  variant={notifications.length > 0 ? 'primary' : 'neutral'}
                >
                  {notifications.length > 0
                    ? `${notifications.length} new`
                    : 'All read'}
                </Tag>
              </Flex>

              <Box classNameOverride={styles.notifList}>
                {notifications.length === 0 ? (
                  <Box px="4" py="6" textAlign="center">
                    <Typography variant="caption" color="muted">
                      No new notifications
                    </Typography>
                  </Box>
                ) : (
                  notifications.map(item => (
                    <Box
                      key={item.id}
                      px="4"
                      py="3"
                      borderBottom
                      classNameOverride={styles.notifItem}
                    >
                      <Flex align="start" gap="3">
                        <StatusDot variant={item.type ?? 'info'} size="sm" />
                        <Flex direction="column" gap="1" flex="1" minW="0">
                          <Typography
                            variant="body-sm"
                            weight="medium"
                            color="white"
                          >
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="muted">
                            {item.description}
                          </Typography>
                          <Typography variant="caption" color="muted">
                            {item.time}
                          </Typography>
                        </Flex>
                      </Flex>
                    </Box>
                  ))
                )}
              </Box>

              {notifications.length > 0 && (
                <Box
                  px="4"
                  py="2"
                  textAlign="center"
                  borderTop
                  classNameOverride={styles.notifFooter}
                >
                  <Typography
                    as="button"
                    type="button"
                    variant="caption"
                    weight="medium"
                    color="primary"
                    onClick={handleClearNotifications}
                    classNameOverride={styles.clearBtn}
                  >
                    Mark all as read
                  </Typography>
                </Box>
              )}
            </Card>
          )}
        </Box>

        <Flex
          as={Link}
          href={docsHref}
          target="_blank"
          rel="noopener noreferrer"
          align="center"
          gap="2"
          classNameOverride={styles.docsLink}
        >
          <Typography
            variant="body-sm"
            weight="medium"
            as="span"
            color="secondary"
          >
            Docs
          </Typography>
          <ExternalLinkIcon width={12} height={12} />
        </Flex>
      </Flex>
    </Box>
  );
}
