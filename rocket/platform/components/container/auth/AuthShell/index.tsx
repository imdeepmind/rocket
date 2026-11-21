import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import Box from '@/components/bits/Box';
import Card from '@/components/bits/Card';
import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';

import styles from './styles.module.css';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  classNameOverride?: string;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  classNameOverride,
}: AuthShellProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.wrapper;

  return (
    <Flex
      as="section"
      align="center"
      justify="center"
      classNameOverride={combinedClass}
    >
      <Flex
        direction="column"
        align="center"
        fullWidth
        classNameOverride={styles.container}
      >
        {/* Brand header */}
        <Box mb="7">
          <Link href="/" className={styles.brandLink} aria-label="Rocket Home">
            <Flex align="center" gap="3">
              <Image
                src="/logo.png"
                alt="Rocket Logo"
                width={32}
                height={32}
                className={styles.brandLogo}
              />
              <Typography variant="body" weight="bold" color="white" as="span">
                Rocket
              </Typography>
            </Flex>
          </Link>
        </Box>

        {/* Auth card */}
        <Card padding="none" fullWidth classNameOverride={styles.card}>
          <Flex direction="column" gap="1" mb="6">
            <Typography variant="h2" as="h1">
              {title}
            </Typography>
            <Typography variant="body-sm" color="muted">
              {subtitle}
            </Typography>
          </Flex>

          <Box fullWidth>{children}</Box>
        </Card>

        {/* Footer outside card */}
        {footer && (
          <Flex justify="center" mt="5" fullWidth>
            {footer}
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
