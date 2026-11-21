'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import React, {useEffect, useState} from 'react';

import Avatar from '@/components/bits/Avatar';
import Box from '@/components/bits/Box';
import Card from '@/components/bits/Card';
import Flex from '@/components/bits/Flex';
import IconButton from '@/components/bits/IconButton';
import ProgressBar from '@/components/bits/ProgressBar';
import Tag from '@/components/bits/Tag';
import Typography from '@/components/bits/Typography';

import ActivityIcon from '@/icons/ActivityIcon';
import ChevronDownIcon from '@/icons/ChevronDownIcon';
import CodeIcon from '@/icons/CodeIcon';
import CreditCardIcon from '@/icons/CreditCardIcon';
import FileTextIcon from '@/icons/FileTextIcon';
import GithubIcon from '@/icons/GithubIcon';
import LayersIcon from '@/icons/LayersIcon';
import SettingsIcon from '@/icons/SettingsIcon';
import SidebarToggleIcon from '@/icons/SidebarToggleIcon';

import {signOut, useSession} from '@/lib/auth/client';

import styles from './styles.module.css';

export interface UsageData {
  used: string;
  total: string;
  percentage?: number;
  upgradeHref?: string;
}

export interface UserProfileData {
  name: string;
  email: string;
  avatarUrl?: string;
}

export const DEFAULT_USAGE: UsageData = {
  used: '12.5k',
  total: '100k',
  percentage: 12.5,
  upgradeHref: '/dashboard/billing',
};

export interface AppSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  activeHref?: string;
  projectCount?: number;
  user?: UserProfileData | null;
  usage?: UsageData;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  classNameOverride?: string;
}

export default function AppSidebar({
  isOpen = true,
  onToggle,
  onClose,
  activeHref,
  projectCount = 3,
  user,
  usage = DEFAULT_USAGE,
  onLogout,
  isLoggingOut: controlledLoggingOut,
  classNameOverride,
}: AppSidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const {data: session} = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [internalLoggingOut, setInternalLoggingOut] = useState(false);

  const isLoggingOut = controlledLoggingOut ?? internalLoggingOut;
  const currentPath = activeHref ?? pathname;

  const sessionUser = session?.user;
  const effectiveUser =
    user ??
    (sessionUser
      ? {name: sessionUser.name ?? '', email: sessionUser.email ?? ''}
      : {name: 'Developer', email: 'developer@example.com'});

  const displayName =
    effectiveUser?.name || effectiveUser?.email?.split('@')[0] || 'Developer';
  const displayEmail = effectiveUser?.email || 'developer@example.com';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('[data-user-menu]')) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  async function handleLogoutClick() {
    setIsDropdownOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      setInternalLoggingOut(true);
      await signOut();
      router.push('/auth/sign-in');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setInternalLoggingOut(false);
    }
  }

  function handleCollapseClick() {
    if (onClose) {
      onClose();
    } else if (onToggle) {
      onToggle();
    }
  }

  function handleLinkClick() {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      onClose?.();
    }
  }

  const workspaceNav = [
    {
      label: 'Projects',
      href: '/dashboard',
      icon: <LayersIcon width={16} height={16} stroke="currentColor" />,
      badge: projectCount,
      active:
        currentPath === '/dashboard' ||
        currentPath === '/dashboard/new' ||
        currentPath.startsWith('/dashboard/projects'),
    },
    {
      label: 'Usage',
      href: '/dashboard/usage',
      icon: <ActivityIcon width={16} height={16} stroke="currentColor" />,
      active: currentPath === '/dashboard/usage',
    },
    {
      label: 'Billing',
      href: '/dashboard/billing',
      icon: <CreditCardIcon width={16} height={16} />,
      active: currentPath === '/dashboard/billing',
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <SettingsIcon width={16} height={16} />,
      active: currentPath === '/dashboard/settings',
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
      label: 'ROSS',
      href: 'https://ross.imdeepmind.com',
      icon: <CodeIcon width={16} height={16} stroke="currentColor" />,
      external: true,
    },
    {
      label: 'GitHub',
      href: 'https://github.com/imdeepmind/rocket',
      icon: (
        <GithubIcon width={16} height={16} fill="currentColor" stroke="none" />
      ),
      external: true,
    },
  ];

  const sidebarClasses = [
    styles.sidebar,
    !isOpen ? styles.sidebarClosed : '',
    isOpen ? styles.sidebarOpenMobile : '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedClass = classNameOverride ?? sidebarClasses;

  return (
    <Box as="aside" classNameOverride={combinedClass}>
      {/* Brand Header */}
      <Flex align="center" justify="between" mb="6" px="1">
        <Flex
          as={Link}
          href="/"
          align="center"
          gap="3"
          onClick={handleLinkClick}
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
        <IconButton
          icon={<SidebarToggleIcon width={16} height={16} />}
          aria-label="Collapse sidebar"
          size="sm"
          classNameOverride={styles.sidebarToggleBtn}
          onClick={handleCollapseClick}
        />
      </Flex>

      {/* Workspace Nav Section */}
      <Box mb="6">
        <Box px="3" pb="2">
          <Typography
            variant="caption"
            color="muted"
            weight="bold"
            letterSpacing="wide"
          >
            WORKSPACE
          </Typography>
        </Box>
        <Flex as="nav" direction="column" gap="1">
          {workspaceNav.map(item => (
            <Flex
              key={item.label}
              as={Link}
              href={item.href}
              align="center"
              justify="between"
              onClick={handleLinkClick}
              classNameOverride={[
                styles.navItem,
                item.active ? styles.navItemActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Flex align="center" gap="3">
                <Flex as="span" align="center" justify="center">
                  {item.icon}
                </Flex>
                <Typography
                  variant="body-sm"
                  weight={item.active ? 'semibold' : 'medium'}
                  color={item.active ? 'white' : 'secondary'}
                  as="span"
                >
                  {item.label}
                </Typography>
              </Flex>
              {item.badge !== undefined && (
                <Tag size="sm" variant={item.active ? 'primary' : 'neutral'}>
                  {item.badge}
                </Tag>
              )}
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Resources Section */}
      <Box mb="6">
        <Box px="3" pb="2">
          <Typography
            variant="caption"
            color="muted"
            weight="bold"
            letterSpacing="wide"
          >
            RESOURCES
          </Typography>
        </Box>
        <Flex as="nav" direction="column" gap="1">
          {resourceNav.map(item => (
            <Flex
              key={item.label}
              as={Link}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              align="center"
              onClick={handleLinkClick}
              classNameOverride={styles.navItem}
            >
              <Flex align="center" gap="3">
                <Flex as="span" align="center" justify="center">
                  {item.icon}
                </Flex>
                <Typography
                  variant="body-sm"
                  weight="medium"
                  color="secondary"
                  as="span"
                >
                  {item.label}
                </Typography>
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Bottom Area: Usage Tracker and User Profile */}
      <Box mt="auto" pt="4" borderTop classNameOverride={styles.bottomArea}>
        {/* Usage Widget */}
        <Box classNameOverride={styles.usageWidget}>
          <Flex justify="between" align="baseline">
            <Typography variant="caption" color="muted">
              Monthly requests
            </Typography>
            <Typography variant="caption" weight="semibold" color="white">
              {usage.used} / {usage.total}
            </Typography>
          </Flex>
          <ProgressBar
            value={usage.percentage ?? 12.5}
            size="sm"
            variant="primary"
          />
          <Typography
            as={Link}
            href={usage.upgradeHref || '/dashboard/billing'}
            variant="caption"
            weight="semibold"
            color="primary"
            classNameOverride={styles.upgradeLink}
          >
            Upgrade plan →
          </Typography>
        </Box>

        {/* User Profile Card & Dropdown */}
        <Box position="relative" mt="3" data-user-menu>
          {isDropdownOpen && (
            <Card
              variant="glass"
              radius="md"
              padding="none"
              classNameOverride={styles.userDropdown}
            >
              <Flex
                as="button"
                type="button"
                align="center"
                gap="2"
                onClick={() => {
                  setIsDropdownOpen(false);
                  router.push('/dashboard/settings');
                }}
                classNameOverride={styles.dropdownItem}
              >
                <SettingsIcon width={14} height={14} />
                <Typography
                  variant="caption"
                  weight="medium"
                  color="white"
                  as="span"
                >
                  Account settings
                </Typography>
              </Flex>
              <Flex
                as="button"
                type="button"
                align="center"
                gap="2"
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
                classNameOverride={[
                  styles.dropdownItem,
                  styles.dropdownItemDanger,
                ].join(' ')}
              >
                <Typography
                  variant="caption"
                  weight="medium"
                  as="span"
                  classNameOverride={styles.dangerText}
                >
                  {isLoggingOut ? 'Signing out...' : 'Sign out'}
                </Typography>
              </Flex>
            </Card>
          )}

          <Flex
            as="button"
            type="button"
            align="center"
            justify="between"
            fullWidth
            onClick={() => setIsDropdownOpen(prev => !prev)}
            aria-expanded={isDropdownOpen}
            classNameOverride={styles.userCard}
          >
            <Flex align="center" gap="3" minW="0">
              <Avatar
                name={displayName}
                size="sm"
                shape="circle"
                variant="primary"
              />
              <Flex direction="column" align="start" minW="0" overflow="hidden">
                <Typography
                  variant="body-sm"
                  weight="semibold"
                  color="white"
                  truncate
                >
                  {displayName}
                </Typography>
                <Typography variant="caption" color="muted" truncate>
                  {displayEmail}
                </Typography>
              </Flex>
            </Flex>
            <ChevronDownIcon
              className={styles.chevronIcon}
              width={14}
              height={14}
            />
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
