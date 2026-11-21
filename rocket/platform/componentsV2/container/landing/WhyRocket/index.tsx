import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';
import WindowFrame from '@/componentsV2/bits/WindowFrame';

import styles from './styles.module.css';

export const DEFAULT_BENEFITS = [
  'Less infrastructure setup',
  'Simplified deployment lifecycle',
  'Centralized deployment management',
  'A straightforward developer experience',
  'PostgreSQL and Redis/Memcached included',
];

export const DEFAULT_TERMINAL_LINES = [
  '# Deploy with just a few lines',
  '$ ross deploy --project my-app',
  '✓ Deployed successfully in 18s',
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
  terminalTitle,
  terminalLines = DEFAULT_TERMINAL_LINES,
  classNameOverride,
}: WhyRocketProps): React.JSX.Element {
  return (
    <Section
      id="docs"
      container="landing"
      pt="16"
      pb="16"
      classNameOverride={classNameOverride}
    >
      <Box classNameOverride={styles.whyLayout}>
        {/* Left: CLI terminal preview */}
        <Box classNameOverride={styles.terminalCol}>
          <WindowFrame
            dots
            title={terminalTitle}
            headerBorder={false}
            variant="glass"
          >
            <Box classNameOverride={styles.terminalContent}>
              {terminalLines.map((line, idx) => {
                if (line.startsWith('#')) {
                  return (
                    <Typography
                      key={idx}
                      variant="mono"
                      color="muted"
                      classNameOverride={styles.terminalLine}
                    >
                      {line}
                    </Typography>
                  );
                }
                if (line.startsWith('$')) {
                  const restOfLine = line.slice(1).trim();
                  return (
                    <Box key={idx} mt="3">
                      <Typography
                        variant="mono"
                        color="primary"
                        classNameOverride={styles.terminalLine}
                      >
                        $
                      </Typography>{' '}
                      <Typography
                        variant="mono"
                        color="white"
                        classNameOverride={styles.terminalLine}
                      >
                        {restOfLine}
                      </Typography>
                    </Box>
                  );
                }
                if (line.startsWith('✓')) {
                  return (
                    <Box key={idx} mt="7">
                      <Typography
                        variant="mono"
                        color="success"
                        classNameOverride={styles.terminalLine}
                      >
                        {line}
                      </Typography>
                    </Box>
                  );
                }
                return (
                  <Typography
                    key={idx}
                    variant="mono"
                    color="white"
                    classNameOverride={styles.terminalLine}
                  >
                    {line}
                  </Typography>
                );
              })}
            </Box>
          </WindowFrame>
        </Box>

        {/* Right: Why Rocket info */}
        <Box classNameOverride={styles.infoCol}>
          {eyebrow && (
            <Box mb="4">
              <Typography variant="eyebrow">{eyebrow}</Typography>
            </Box>
          )}
          <Box mb="8">
            <Typography variant="display" as="h2">
              {title}
            </Typography>
          </Box>

          <Flex as="ul" direction="column" gap="5" listStyle="none" p="0" m="0">
            {benefits.map(benefit => (
              <Flex as="li" align="center" gap="4" key={benefit}>
                <IconBadge variant="primary" size="sm" rounded="full">
                  ✓
                </IconBadge>
                <Typography
                  variant="body-lg"
                  as="span"
                  color="secondary"
                  classNameOverride={styles.checkItemText}
                >
                  {benefit}
                </Typography>
              </Flex>
            ))}
          </Flex>
        </Box>
      </Box>
    </Section>
  );
}
