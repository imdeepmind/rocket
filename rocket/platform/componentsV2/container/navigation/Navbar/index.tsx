'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {useEffect, useState} from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import IconButton from '@/componentsV2/bits/IconButton';
import Typography from '@/componentsV2/bits/Typography';

import CloseIcon from '@/icons/CloseIcon';
import MenuIcon from '@/icons/MenuIcon';

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

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) {
        setIsOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <Box
      as="header"
      maxW="landing"
      mx="auto"
      px="5"
      py="5"
      fullWidth
      position="relative"
      classNameOverride={classNameOverride}
    >
      <Flex align="center" justify="between" gap="4" wrap="wrap">
        <Flex
          as={Link}
          href="/"
          align="center"
          gap="3"
          onClick={closeMenu}
          classNameOverride={styles.logoLink}
        >
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
        </Flex>

        {/* Desktop Navigation */}
        <Flex
          as="nav"
          align="center"
          gap="9"
          classNameOverride={styles.desktopNav}
          aria-label="Main Navigation"
        >
          {links.map(link =>
            link.external ? (
              <Typography
                key={link.label}
                as="a"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                color="secondary"
                classNameOverride={styles.navLink}
              >
                {link.label}
              </Typography>
            ) : (
              <Typography
                key={link.label}
                as={Link}
                href={link.href}
                color="secondary"
                classNameOverride={styles.navLink}
              >
                {link.label}
              </Typography>
            ),
          )}
        </Flex>

        {/* Header Actions */}
        <Flex align="center" gap="6" classNameOverride={styles.desktopActions}>
          {isLoggedIn ? (
            <>
              <Typography
                as={Link}
                href={dashboardHref}
                color="secondary"
                classNameOverride={styles.navLink}
              >
                Dashboard
              </Typography>
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
              <Typography
                as={Link}
                href={signInHref}
                color="secondary"
                classNameOverride={styles.navLink}
              >
                Sign In
              </Typography>
              <Button size="md" variant="primary" href={signUpHref}>
                Get started
              </Button>
            </>
          )}
        </Flex>

        {/* Mobile Menu Toggle Button */}
        <Box classNameOverride={styles.mobileToggle}>
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
        </Box>

        {/* Mobile Dropdown Menu */}
        {isOpen && (
          <Box classNameOverride={styles.mobileMenu}>
            <Flex
              as="nav"
              direction="column"
              gap="3"
              aria-label="Mobile Navigation"
            >
              {links.map(link =>
                link.external ? (
                  <Typography
                    key={link.label}
                    as="a"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    color="secondary"
                    classNameOverride={styles.mobileNavLink}
                  >
                    {link.label}
                  </Typography>
                ) : (
                  <Typography
                    key={link.label}
                    as={Link}
                    href={link.href}
                    onClick={closeMenu}
                    color="secondary"
                    classNameOverride={styles.mobileNavLink}
                  >
                    {link.label}
                  </Typography>
                ),
              )}
              {isLoggedIn ? (
                <Typography
                  as={Link}
                  href={dashboardHref}
                  onClick={closeMenu}
                  color="secondary"
                  classNameOverride={styles.mobileNavLink}
                >
                  Dashboard
                </Typography>
              ) : (
                <Typography
                  as={Link}
                  href={signInHref}
                  onClick={closeMenu}
                  color="secondary"
                  classNameOverride={styles.mobileNavLink}
                >
                  Sign In
                </Typography>
              )}
            </Flex>
            <Flex direction="column" gap="2" mt="2">
              {isLoggedIn ? (
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => {
                    closeMenu();
                    onLogout?.();
                  }}
                  loading={isLoggingOut}
                  fullWidth
                >
                  Logout
                </Button>
              ) : (
                <Button
                  size="md"
                  variant="primary"
                  href={signUpHref}
                  onClick={closeMenu}
                  fullWidth
                >
                  Get started
                </Button>
              )}
            </Flex>
          </Box>
        )}
      </Flex>
    </Box>
  );
}
