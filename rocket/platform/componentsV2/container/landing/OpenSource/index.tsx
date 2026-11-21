import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

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
  classNameOverride,
}: OpenSourceProps): React.JSX.Element {
  return (
    <Section
      container="landing"
      spacing="lg"
      classNameOverride={classNameOverride}
    >
      <Flex align="center" gap="16" wrap="wrap">
        {/* Left: About ROSS and Rocket */}
        <Flex direction="column" gap="4" flex="1" minW="0" basis="480">
          {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
          <Typography variant="h2" as="h2">
            {title}
          </Typography>

          <Box my="2">
            <Typography variant="lead">{leadText}</Typography>
          </Box>

          <Typography variant="body" color="muted">
            {bodyText}
          </Typography>

          <Flex gap="3" mt="4" wrap="wrap">
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
        </Flex>

        {/* Right: ROSS handles card */}
        <Box flex="1" minW="0" basis="420">
          <Card padding="lg" variant="glass" fullWidth>
            <Box mb="5">
              <Typography variant="mono" color="muted">
                One JSON configuration. ROSS handles:
              </Typography>
            </Box>

            <Flex direction="column" gap="3" mb="6">
              {features.map(item => (
                <Card key={item} padding="sm" variant="subtle">
                  <Flex align="center" gap="3">
                    <IconBadge variant="success" size="xs" rounded="full">
                      ✓
                    </IconBadge>
                    <Typography variant="body" as="span">
                      {item}
                    </Typography>
                  </Flex>
                </Card>
              ))}
            </Flex>

            <Box pt="4" borderTop>
              <Typography variant="caption" color="muted">
                Bring your ROSS configuration. Rocket deploys it with PostgreSQL
                and Redis/Memcached included.
              </Typography>
            </Box>
          </Card>
        </Box>
      </Flex>
    </Section>
  );
}
