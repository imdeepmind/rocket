import React from 'react';

import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Grid from '@/componentsV2/bits/Grid';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

export interface HowItWorksStep {
  stepNumber: number;
  title: string;
  description: string;
}

export const DEFAULT_STEPS: HowItWorksStep[] = [
  {
    stepNumber: 1,
    title: 'Configure',
    description:
      'Provide your backend and deployment requirements in structured JSON.',
  },
  {
    stepNumber: 2,
    title: 'Deploy',
    description:
      'Rocket provisions the required infrastructure, PostgreSQL, and Redis automatically.',
  },
  {
    stepNumber: 3,
    title: 'Manage',
    description:
      'Access your deployed APIs, inspect health, and manage your services from one place.',
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
      spacing="lg"
      classNameOverride={classNameOverride}
    >
      <Flex direction="column" gap="3" mb="12">
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="h2" as="h2" maxW="600">
          {title}
        </Typography>
      </Flex>

      <Grid minItemWidth="280" gap="6">
        {steps.map(step => (
          <Card key={step.stepNumber} padding="lg" variant="glass">
            <Flex direction="column" gap="3">
              <IconBadge variant="surface" size="md" rounded="full">
                {step.stepNumber}
              </IconBadge>
              <Typography variant="h3" as="h3">
                {step.title}
              </Typography>
              <Typography variant="caption" color="muted">
                {step.description}
              </Typography>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}
