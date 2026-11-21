'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useEffect, useState} from 'react';

import Button from '@/components/bits/Button';

import CloseIcon from '@/icons/CloseIcon';
import MenuIcon from '@/icons/MenuIcon';

import {signOut, useSession} from '@/lib/auth/client';

import styles from './styles.module.css';

export default function Navbar(): React.JSX.Element {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {data: session} = useSession();

  const isLoggedIn = Boolean(session?.user);

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

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOut();
      closeMenu();
      router.refresh();
    } catch (err) {
      console.error('Failed to log out:', err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className={styles.header}>
      <Link href="/" onClick={closeMenu} className={styles.logo}>
        <Image
          src="/logo.png"
          alt="Rocket Logo"
          width={32}
          height={32}
          style={{objectFit: 'contain', display: 'block', borderRadius: '6px'}}
        />
        Rocket
      </Link>

      {/* Desktop Navigation */}
      <nav className={styles.navLinks}>
        <Link href="/">Home</Link>
        <a
          href="https://ross.imdeepmind.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          ROSS
        </a>
        <Link href="/docs">Docs</Link>
        <Link href="/pricing">Pricing</Link>
        <a
          href="https://github.com/imdeepmind/rocket"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </nav>

      {/* Header Actions */}
      <div className={styles.headerActions}>
        {isLoggedIn ? (
          <>
            <Link href="/dashboard" className={styles.signInLink}>
              Dashboard
            </Link>
            <Button size="md" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </>
        ) : (
          <>
            <Link href="/auth/sign-in" className={styles.signInLink}>
              Sign In
            </Link>
            <Button href="/auth/sign-up" size="md">
              Get started
            </Button>
          </>
        )}
      </div>

      {/* Mobile Toggle */}
      <button
        type="button"
        className={styles.mobileMenuToggle}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${isOpen ? styles.isOpen : ''}`}>
        <Link href="/" onClick={closeMenu}>
          Home
        </Link>
        <a
          href="https://ross.imdeepmind.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          ROSS
        </a>
        <Link href="/docs" onClick={closeMenu}>
          Docs
        </Link>
        <Link href="/pricing" onClick={closeMenu}>
          Pricing
        </Link>
        <a
          href="https://github.com/imdeepmind/rocket"
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          GitHub
        </a>
        {isLoggedIn ? (
          <>
            <Link href="/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
            <Button
              size="md"
              fullWidth
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{marginTop: '8px'}}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </>
        ) : (
          <>
            <Link href="/auth/sign-in" onClick={closeMenu}>
              Sign In
            </Link>
            <Button
              href="/auth/sign-up"
              size="md"
              fullWidth
              onClick={closeMenu}
              style={{marginTop: '8px'}}
            >
              Get started
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
