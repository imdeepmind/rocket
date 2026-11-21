import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
import Grid from '@/componentsV2/bits/Grid';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface HowItWorksStep {
  stepNumber: number;
  title: string;
  description: string;
}

export const DEFAULT_STEPS: HowItWorksStep[] = [
  {
    stepNumber: 1,
    title: 'Configure',
    description: 'Provide your backend and deployment requirements.',
  },
  {
    stepNumber: 2,
    title: 'Deploy',
    description:
      'Rocket provisions the required infrastructure and deploys your service.',
  },
  {
    stepNumber: 3,
    title: 'Manage',
    description:
      'Access your deployed APIs and manage their lifecycle through the platform.',
  },
];

export interface HowItWorksProps {
  eyebrow?: string;
  title?: string;
  steps?: HowItWorksStep[];
  classNameOverride?: string;
}

export default function HowItWorks({
  eyebrow = 'How it works',
  title = 'From configuration to production in a few steps.',
  steps = DEFAULT_STEPS,
  classNameOverride,
}: HowItWorksProps): React.JSX.Element {
  return (
    <Section
      id="how"
      container="landing"
      pt="16"
      pb="30"
      align="center"
      classNameOverride={classNameOverride}
    >
      <Flex
        direction="column"
        align="center"
        textAlign="center"
        gap="4"
        mb="20"
      >
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="display" as="h2" maxW="760" align="center">
          {title}
        </Typography>
      </Flex>

      <Box position="relative">
        <Box classNameOverride={styles.howLine} aria-hidden="true" />
        <Grid minItemWidth="240" rowGap="12" columnGap="10">
          {steps.map(step => (
            <Flex
              key={step.stepNumber}
              direction="column"
              align="center"
              textAlign="center"
            >
              <Box mb="6">
                <IconBadge variant="step" size="xxl" rounded="full">
                  {step.stepNumber}
                </IconBadge>
              </Box>
              <Box mb="2">
                <Typography variant="h2" as="h3">
                  {step.title}
                </Typography>
              </Box>
              <Typography variant="body-lg" color="secondary" maxW="280">
                {step.description}
              </Typography>
            </Flex>
          ))}
        </Grid>
      </Box>
    </Section>
  );
}
