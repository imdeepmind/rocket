'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import ActivityIcon from '@/icons/ActivityIcon';
import CreditCardIcon from '@/icons/CreditCardIcon';
import FileTextIcon from '@/icons/FileTextIcon';
import GithubIcon from '@/icons/GithubIcon';
import GlobeIcon from '@/icons/GlobeIcon';
import LayersIcon from '@/icons/LayersIcon';
import SettingsIcon from '@/icons/SettingsIcon';
import SidebarToggleIcon from '@/icons/SidebarToggleIcon';

import Avatar from '@/componentsV2/bits/Avatar';
import Button from '@/componentsV2/bits/Button';
import IconButton from '@/componentsV2/bits/IconButton';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface UserProfileData {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface AppSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  activeHref?: string;
  projectCount?: number;
  user?: UserProfileData | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  classNameOverride?: string;
}

export default function AppSidebar({
  isOpen = true,
  onToggle,
  onClose,
  activeHref = '/dashboard',
  projectCount = 3,
  user = {name: 'Developer', email: 'developer@example.com'},
  onLogout,
  isLoggingOut = false,
  classNameOverride,
}: AppSidebarProps): React.JSX.Element {
  const sidebarClasses = [styles.sidebar, isOpen ? styles.open : styles.closed]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? sidebarClasses;

  const workspaceNav = [
    {
      label: 'Projects',
      href: '/dashboard',
      icon: <LayersIcon width={16} height={16} />,
      badge: projectCount,
      active:
        activeHref === '/dashboard' ||
        activeHref === '/dashboard/new' ||
        activeHref.startsWith('/dashboard/projects'),
    },
    {
      label: 'Usage',
      href: '/dashboard/usage',
      icon: <ActivityIcon width={16} height={16} />,
      active: activeHref === '/dashboard/usage',
    },
    {
      label: 'Billing',
      href: '/dashboard/billing',
      icon: <CreditCardIcon width={16} height={16} />,
      active: activeHref === '/dashboard/billing',
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <SettingsIcon width={16} height={16} />,
      active: activeHref === '/dashboard/settings',
    },
  ];

  const resourceNav = [
    {
      label: 'Documentation',
      href: '/docs',
      icon: <FileTextIcon width={16} height={16} />,
      external: true,
    },
    {
      label: 'ROSS Framework',
      href: 'https://ross.imdeepmind.com',
      icon: <GlobeIcon width={16} height={16} />,
      external: true,
    },
    {
      label: 'GitHub',
      href: 'https://github.com/imdeepmind/rocket',
      icon: <GithubIcon width={16} height={16} />,
      external: true,
    },
  ];

  return (
    <aside className={combinedClass}>
      {/* Brand Header */}
      <div className={styles.header}>
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

        {(onClose || onToggle) && (
          <IconButton
            icon={<SidebarToggleIcon width={18} height={18} />}
            aria-label="Collapse sidebar"
            size="sm"
            variant="ghost"
            onClick={onClose || onToggle}
          />
        )}
      </div>

      {/* Navigation Sections */}
      <div className={styles.navSections}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Typography variant="caption" color="muted" weight="bold">
              WORKSPACE
            </Typography>
          </div>
          <nav className={styles.navList}>
            {workspaceNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  styles.navItem,
                  item.active ? styles.activeItem : '',
                ].join(' ')}
              >
                <span className={styles.itemIcon}>{item.icon}</span>
                <span className={styles.itemLabel}>{item.label}</span>
                {typeof item.badge !== 'undefined' && (
                  <Tag size="sm" variant={item.active ? 'primary' : 'neutral'}>
                    {item.badge}
                  </Tag>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Typography variant="caption" color="muted" weight="bold">
              DEVELOPER
            </Typography>
          </div>
          <nav className={styles.navList}>
            {resourceNav.map(item => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.navItem}
              >
                <span className={styles.itemIcon}>{item.icon}</span>
                <span className={styles.itemLabel}>{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* User Profile Footer */}
      {user && (
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <Avatar name={user.name} size="sm" shape="circle" variant="user" />
            <div className={styles.userText}>
              <Typography variant="body-sm" weight="semibold" truncate>
                {user.name}
              </Typography>
              <Typography variant="caption" color="muted" truncate>
                {user.email}
              </Typography>
            </div>
          </div>
          {onLogout && (
            <Button
              size="xs"
              variant="ghost"
              onClick={onLogout}
              loading={isLoggingOut}
            >
              Sign out
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
