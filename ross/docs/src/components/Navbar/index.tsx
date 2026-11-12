import React, { useState, useEffect } from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { GithubIcon, MenuIcon, CloseIcon } from '@site/src/icons';
import styles from './styles.module.css';

export default function Navbar(): React.JSX.Element {
  const logoUrl = useBaseUrl('/img/logo.png');
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
      <Link
        to="/"
        onClick={closeMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#fff',
          fontWeight: 600,
          fontSize: '17px',
          textDecoration: 'none',
        }}
      >
        <img
          src={logoUrl}
          alt="Rocket Logo"
          width="32"
          height="32"
          style={{ objectFit: 'contain', display: 'block', borderRadius: '6px' }}
        />
        ROSS
      </Link>

      {/* Desktop Navigation */}
      <nav className={styles.navLinks}>
        <Link to="/">Home</Link>
        <Link to="/docs">Documentation</Link>
        <a
          href="https://github.com/imdeepmind/rocket"
          target="_blank"
          rel="noopener noreferrer"
        >
          Rocket
        </a>
      </nav>

      {/* Action buttons (GitHub + Get started + Mobile hamburger) */}
      <div className={styles.headerActions}>
        <a
          href="https://github.com/imdeepmind/rocket"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubIconBtn}
          aria-label="GitHub Repository"
        >
          <GithubIcon />
        </a>

        <Link
          className={`${styles.btn} ${styles.desktopOnlyBtn}`}
          to="/docs/get-started"
        >
          Get started
        </Link>

        {/* Mobile menu toggle button */}
        <button
          type="button"
          className={styles.mobileMenuToggle}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <div className={`${styles.mobileMenu} ${isOpen ? styles.isOpen : ''}`}>
        <Link className={styles.mobileNavLink} to="/" onClick={closeMenu}>
          Home
        </Link>
        <Link className={styles.mobileNavLink} to="/docs" onClick={closeMenu}>
          Documentation
        </Link>
        <a
          className={styles.mobileNavLink}
          href="https://github.com/imdeepmind/rocket"
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          Rocket
        </a>
        <div className={styles.mobileCta}>
          <Link
            className={styles.btn}
            to="/docs/get-started"
            onClick={closeMenu}
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
