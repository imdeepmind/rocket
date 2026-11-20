'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import React, {useState} from 'react';

import Badge from '@/app/components/bits/Badge';

import {
  ActivityIcon,
  ChevronDownIcon,
  CodeIcon,
  CreditCardIcon,
  FileTextIcon,
  GithubIcon,
  LayersIcon,
  SettingsIcon,
  SidebarToggleIcon,
} from '@/app/icons';

import {signOut, useSession} from '@/app/lib/auth/client';

import styles from './styles.module.css';

export interface AppSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  projectCount?: number;
}

export function AppSidebar({
  isOpen = true,
  onToggle,
  onClose,
  projectCount = 3,
}: AppSidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const {data: session} = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = session?.user;
  const displayName = user?.name || user?.email?.split('@')[0] || 'Developer';
  const displayEmail = user?.email || 'developer@example.com';
  const avatarInitials = displayName
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.push('/auth/sign-in');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
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
        pathname === '/dashboard' ||
        pathname === '/dashboard/new' ||
        pathname.startsWith('/dashboard/projects'),
    },
    {
      label: 'Usage',
      href: '/dashboard/usage',
      icon: <ActivityIcon width={16} height={16} stroke="currentColor" />,
      active: pathname === '/dashboard/usage',
    },
    {
      label: 'Billing',
      href: '/dashboard/billing',
      icon: <CreditCardIcon width={16} height={16} />,
      active: pathname === '/dashboard/billing',
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <SettingsIcon width={16} height={16} />,
      active: pathname === '/dashboard/settings',
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
      icon: <CodeIcon width={16} height={16} />,
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

  return (
    <aside
      className={[
        styles.sidebar,
        !isOpen ? styles.sidebarClosed : '',
        isOpen ? styles.sidebarOpenMobile : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Brand Header */}
      <div className={styles.header}>
        <Link href="/" className={styles.brand} onClick={handleLinkClick}>
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
        <button
          type="button"
          className={styles.sidebarToggleBtn}
          onClick={handleCollapseClick}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <SidebarToggleIcon width={16} height={16} />
        </button>
      </div>

      {/* Workspace Nav Section */}
      <div className={styles.navSection}>
        <div className={styles.sectionLabel}>Workspace</div>
        <nav className={styles.navLinks}>
          {workspaceNav.map(item => (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleLinkClick}
              className={[
                styles.navItem,
                item.active ? styles.navItemActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.navItemLeft}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <Badge variant="count">{item.badge}</Badge>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Resources Section */}
      <div className={styles.navSection}>
        <div className={styles.sectionLabel}>Resources</div>
        <nav className={styles.navLinks}>
          {resourceNav.map(item =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.navItem}
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={handleLinkClick}
                className={styles.navItem}
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            ),
          )}
        </nav>
      </div>

      {/* Bottom area: Usage Tracker and User Profile */}
      <div className={styles.bottomArea}>
        <div className={styles.usageWidget}>
          <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>Monthly requests</span>
            <span className={styles.usageValue}>12.5k / 100k</span>
          </div>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} />
          </div>
          <Link href="/dashboard/billing" className={styles.upgradeLink}>
            Upgrade plan →
          </Link>
        </div>

        <div className={styles.userProfileWrapper}>
          {isDropdownOpen && (
            <div className={styles.userDropdown}>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setIsDropdownOpen(false);
                  router.push('/dashboard/settings');
                }}
              >
                <SettingsIcon width={14} height={14} />
                Account settings
              </button>
              <button
                type="button"
                className={[
                  styles.dropdownItem,
                  styles.dropdownItemDanger,
                ].join(' ')}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}

          <button
            type="button"
            className={styles.userCard}
            onClick={() => setIsDropdownOpen(prev => !prev)}
            aria-expanded={isDropdownOpen}
          >
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>{avatarInitials || 'AC'}</div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userEmail}>{displayEmail}</span>
              </div>
            </div>
            <ChevronDownIcon
              className={styles.chevronIcon}
              width={14}
              height={14}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;
