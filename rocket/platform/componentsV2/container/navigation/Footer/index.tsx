import Link from 'next/link';
import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface NavLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

export const DEFAULT_FOOTER_LINKS: NavLinkItem[] = [
  {label: 'Home', href: '/'},
  {label: 'ROSS', href: 'https://ross.imdeepmind.com', external: true},
  {label: 'Docs', href: '/docs'},
  {label: 'Pricing', href: '/pricing'},
  {
    label: 'GitHub',
    href: 'https://github.com/imdeepmind/rocket',
    external: true,
  },
  {label: 'Sign In', href: '/auth/sign-in'},
];

export interface FooterProps {
  copyright?: string;
  links?: NavLinkItem[];
  classNameOverride?: string;
}

export default function Footer({
  copyright = 'Copyright © 2026 Abhishek Chatterjee',
  links = DEFAULT_FOOTER_LINKS,
  classNameOverride,
}: FooterProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.footer;

  return (
    <Box as="footer" classNameOverride={combinedClass}>
      <Box classNameOverride={styles.footerInner}>
        <Typography variant="caption" color="muted">
          {copyright}
        </Typography>

        <Box
          as="nav"
          classNameOverride={styles.footerLinks}
          aria-label="Footer Navigation"
        >
          {(links || DEFAULT_FOOTER_LINKS).map(link =>
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
        </Box>
      </Box>
    </Box>
  );
}
