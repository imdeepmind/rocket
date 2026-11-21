import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';
import TerminalViewer from '@/componentsV2/items/TerminalViewer';

export const DEFAULT_BENEFITS = [
  'Less infrastructure setup',
  'Simplified deployment lifecycle',
  'Centralized deployment management',
  'A straightforward developer experience',
  'PostgreSQL and Redis/Memcached included',
];

export const DEFAULT_TERMINAL_LINES = [
  '# Deploy with just a few lines',
  '$ rocket deploy --project my-app',
  '✓ Deployed successfully in 42s',
];

export interface WhyRocketProps {
  eyebrow?: string;
  title?: string;
  benefits?: string[];
  terminalTitle?: string;
  terminalLines?: string[];
  classNameOverride?: string;
}

export default function WhyRocket({
  eyebrow = 'Why Rocket',
  title = 'Spend less time managing infrastructure.',
  benefits = DEFAULT_BENEFITS,
  terminalTitle = 'bash — deploy',
  terminalLines = DEFAULT_TERMINAL_LINES,
  classNameOverride,
}: WhyRocketProps): React.JSX.Element {
  return (
    <Section
      id="docs"
      container="landing"
      spacing="lg"
      classNameOverride={classNameOverride}
    >
      <Flex align="center" gap="16" wrap="wrap">
        {/* Left: CLI terminal preview */}
        <Box flex="1" minW="0" basis="440">
          <TerminalViewer
            title={terminalTitle}
            lines={terminalLines}
            activeCursor
            showDots
          />
        </Box>

        {/* Right: Why Rocket info */}
        <Flex direction="column" gap="4" flex="1" minW="0" basis="440">
          {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
          <Typography variant="h2" as="h2">
            {title}
          </Typography>

          <Flex
            as="ul"
            direction="column"
            gap="3"
            mt="4"
            listStyle="none"
            p="0"
            m="0"
          >
            {benefits.map(benefit => (
              <Flex as="li" align="center" gap="3" key={benefit}>
                <IconBadge variant="success" size="sm" rounded="full">
                  ✓
                </IconBadge>
                <Typography variant="body" as="span">
                  {benefit}
                </Typography>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Flex>
    </Section>
  );
}
