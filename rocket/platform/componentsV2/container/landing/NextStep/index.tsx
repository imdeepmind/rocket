import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Flex from '@/componentsV2/bits/Flex';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface NextStepProps {
  title?: string;
  description?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  classNameOverride?: string;
}

export default function NextStep({
  title = 'Ship your backend. Not your infrastructure headaches.',
  description = 'Get your backend deployed and focus on what matters: building your product.',
  primaryCtaText = 'Get started',
  primaryCtaHref = '/docs/get-started',
  secondaryCtaText = 'Read the documentation',
  secondaryCtaHref = '/docs',
  classNameOverride,
}: NextStepProps): React.JSX.Element {
  return (
    <Section
      container="landing"
      spacing="hero"
      position="relative"
      overflow="hidden"
      align="center"
      classNameOverride={classNameOverride}
    >
      <Box classNameOverride={styles.glow} aria-hidden="true" />
      <Flex
        direction="column"
        align="center"
        gap="5"
        maxW="720"
        position="relative"
        mx="auto"
      >
        <Typography variant="h2" as="h2" align="center">
          {title}
        </Typography>
        <Typography variant="lead" align="center">
          {description}
        </Typography>
        <Flex gap="3" mt="4" wrap="wrap" justify="center">
          <Button href={primaryCtaHref} size="lg" variant="primary">
            {primaryCtaText}
          </Button>
          <Button href={secondaryCtaHref} size="lg" variant="ghost">
            {secondaryCtaText}
          </Button>
        </Flex>
      </Flex>
    </Section>
  );
}
