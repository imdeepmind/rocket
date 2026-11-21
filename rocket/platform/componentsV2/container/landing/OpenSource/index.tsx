import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';
import WindowFrame from '@/componentsV2/bits/WindowFrame';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

import styles from './styles.module.css';

export const DEFAULT_ROSS_FEATURES = [
  'Database schema generation',
  'RESTful routing',
  'Authentication',
  'Request validation',
  'Interactive documentation',
];

export interface OpenSourceProps {
  eyebrow?: string;
  title?: string;
  leadText?: string;
  bodyText?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  features?: string[];
  showDots?: boolean;
  classNameOverride?: string;
}

export default function OpenSource({
  eyebrow = 'Built on open source',
  title = 'Rocket is built on ROSS.',
  leadText = 'ROSS, Rocket Open Source Software, also known as Rocket Core, is a configuration-driven API framework that automates the standard engineering tasks of backend development. Define your models in structured JSON and ROSS does the rest.',
  bodyText = 'Rocket takes that same ROSS configuration and turns it into a live, hosted API, with the database and deployment handled for you. Prefer to run it yourself? ROSS is open source, so you can start there and move to Rocket whenever you want hosting off your plate.',
  primaryCtaText = 'Deploy your ROSS config',
  primaryCtaHref = 'https://github.com/imdeepmind/rocket',
  secondaryCtaText = 'View ROSS on GitHub',
  secondaryCtaHref = 'https://github.com/imdeepmind/rocket',
  features = DEFAULT_ROSS_FEATURES,
  showDots = false,
  classNameOverride,
}: OpenSourceProps): React.JSX.Element {
  return (
    <Section
      container="landing"
      pt="16"
      pb="16"
      classNameOverride={classNameOverride}
    >
      <Box classNameOverride={styles.openLayout}>
        {/* Left: About ROSS and Rocket */}
        <Box classNameOverride={styles.openInfoCol}>
          {eyebrow && (
            <Box mb="4">
              <Typography variant="eyebrow">{eyebrow}</Typography>
            </Box>
          )}
          <Box mb="6">
            <Typography variant="display" as="h2">
              {title}
            </Typography>
          </Box>

          <Box mb="4">
            <Typography variant="lead" color="secondary" maxW="520">
              {leadText}
            </Typography>
          </Box>

          <Box mb="8">
            <Typography variant="lead" color="secondary" maxW="520">
              {bodyText}
            </Typography>
          </Box>

          <Flex gap="4" wrap="wrap">
            <Button
              href={primaryCtaHref}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="primary"
              rightIcon={<ArrowRightIcon width={16} height={16} />}
            >
              {primaryCtaText}
            </Button>
            <Button
              href={secondaryCtaHref}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="ghost"
            >
              {secondaryCtaText}
            </Button>
          </Flex>
        </Box>

        {/* Right: ROSS handles window */}
        <Box classNameOverride={styles.configCol}>
          <WindowFrame
            dots={showDots}
            headerBorder={false}
            variant="glass"
            classNameOverride={styles.configWindow}
          >
            <Box mb="6">
              <Typography variant="mono" color="muted">
                One JSON configuration. ROSS handles:
              </Typography>
            </Box>

            <Flex direction="column" gap="3" mb="6">
              {features.map(item => (
                <Card key={item} padding="row" variant="subtle" radius="xl">
                  <Flex align="center" gap="4">
                    <IconBadge variant="success-solid" size="sm" rounded="full">
                      ✓
                    </IconBadge>
                    <Typography
                      variant="body-lg"
                      weight="semibold"
                      color="white"
                      as="span"
                    >
                      {item}
                    </Typography>
                  </Flex>
                </Card>
              ))}
            </Flex>

            <Typography
              variant="body-sm"
              color="secondary"
              classNameOverride={styles.cardFooterNote}
            >
              Bring your ROSS configuration. Rocket deploys it with PostgreSQL
              and Redis/Memcached included.
            </Typography>
          </WindowFrame>
        </Box>
      </Box>
    </Section>
  );
}
