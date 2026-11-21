import Link from 'next/link';
import React from 'react';

import Typography from '@/componentsV2/bits/Typography';
import {
  DEFAULT_NAV_LINKS,
  NavLinkItem,
} from '@/componentsV2/container/navigation/Navbar';

import styles from './styles.module.css';

export interface FooterProps {
  copyright?: string;
  links?: NavLinkItem[];
  classNameOverride?: string;
}

export default function Footer({
  copyright = 'Copyright © 2026 Abhishek Chatterjee',
  links = DEFAULT_NAV_LINKS,
  classNameOverride,
}: FooterProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.footer;

  return (
    <footer className={combinedClass}>
      <div className={styles.footerInner}>
        <Typography variant="caption" color="muted">
          {copyright}
        </Typography>

        <nav className={styles.footerLinks} aria-label="Footer Navigation">
          {links.map(link =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.label} href={link.href} className={styles.link}>
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
