'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {useEffect, useState} from 'react';

import CloseIcon from '@/icons/CloseIcon';
import MenuIcon from '@/icons/MenuIcon';

import Button from '@/componentsV2/bits/Button';
import IconButton from '@/componentsV2/bits/IconButton';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface NavLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

export const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  {label: 'Home', href: '/'},
  {label: 'ROSS', href: 'https://ross.imdeepmind.com', external: true},
  {label: 'Docs', href: '/docs'},
  {label: 'Pricing', href: '/pricing'},
  {
    label: 'GitHub',
    href: 'https://github.com/imdeepmind/rocket',
    external: true,
  },
];

export interface NavbarProps {
  links?: NavLinkItem[];
  isLoggedIn?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  dashboardHref?: string;
  signInHref?: string;
  signUpHref?: string;
  classNameOverride?: string;
}

export default function Navbar({
  links = DEFAULT_NAV_LINKS,
  isLoggedIn = false,
  onLogout,
  isLoggingOut = false,
  dashboardHref = '/dashboard',
  signInHref = '/auth/sign-in',
  signUpHref = '/auth/sign-up',
  classNameOverride,
}: NavbarProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  const combinedClass = classNameOverride ?? styles.header;

  return (
    <header className={combinedClass}>
      <Link href="/" onClick={closeMenu} className={styles.logo}>
        <Image
          src="/logo.png"
          alt="Rocket Logo"
          width={32}
          height={32}
          className={styles.logoImage}
        />
        <Typography variant="body" weight="bold" color="white" as="span">
          Rocket
        </Typography>
      </Link>

      {/* Desktop Navigation */}
      <nav className={styles.navLinks} aria-label="Main Navigation">
        {links.map(link =>
          link.external ? (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navLink}
            >
              {link.label}
            </a>
          ) : (
            <Link key={link.label} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ),
        )}
      </nav>

      {/* Header Actions */}
      <div className={styles.headerActions}>
        {isLoggedIn ? (
          <>
            <Link href={dashboardHref} className={styles.signInLink}>
              Dashboard
            </Link>
            <Button
              size="md"
              variant="secondary"
              onClick={onLogout}
              loading={isLoggingOut}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link href={signInHref} className={styles.signInLink}>
              Sign In
            </Link>
            <Button size="md" variant="primary" href={signUpHref}>
              Sign Up
            </Button>
          </>
        )}
      </div>

      {/* Mobile Menu Toggle Button */}
      <div className={styles.mobileToggleWrapper}>
        <IconButton
          icon={
            isOpen ? (
              <CloseIcon width={20} height={20} />
            ) : (
              <MenuIcon width={20} height={20} />
            )
          }
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          size="md"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNavLinks}>
            {links.map(link =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className={styles.mobileNavLink}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={closeMenu}
                  className={styles.mobileNavLink}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          <div className={styles.mobileActions}>
            {isLoggedIn ? (
              <>
                <Button
                  size="md"
                  variant="secondary"
                  href={dashboardHref}
                  onClick={closeMenu}
                  fullWidth
                >
                  Dashboard
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => {
                    closeMenu();
                    onLogout?.();
                  }}
                  loading={isLoggingOut}
                  fullWidth
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="md"
                  variant="outline"
                  href={signInHref}
                  onClick={closeMenu}
                  fullWidth
                >
                  Sign In
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  href={signUpHref}
                  onClick={closeMenu}
                  fullWidth
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
