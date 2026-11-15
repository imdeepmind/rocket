'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MenuIcon, CloseIcon } from '@/app/icons';
import Button from '@/app/components/bits/Button';
import styles from './styles.module.css';

export default function Navbar(): React.JSX.Element {
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

  return (
    <header className={styles.header}>
      <Link href="/" onClick={closeMenu} className={styles.logo}>
        <Image
          src="/logo.png"
          alt="Rocket Logo"
          width={32}
          height={32}
          style={{ objectFit: 'contain', display: 'block', borderRadius: '6px' }}
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
        <Link href="/sign-in" className={styles.signInLink}>
          Sign In
        </Link>
        <Button href="/docs/get-started" size="md">
          Get started
        </Button>
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
        <Link href="/sign-in" onClick={closeMenu}>
          Sign In
        </Link>
        <Button
          href="/docs/get-started"
          size="md"
          fullWidth
          onClick={closeMenu}
          style={{ marginTop: '8px' }}
        >
          Get started
        </Button>
      </div>
    </header>
  );
}
