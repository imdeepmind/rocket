import React from 'react';

import Card from '@/componentsV2/bits/Card';
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
  const combinedClass = classNameOverride ?? styles.howSection;

  return (
    <section id="how" className={combinedClass}>
      <div className={styles.header}>
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="h2" as="h2" classNameOverride={styles.title}>
          {title}
        </Typography>
      </div>

      <div className={styles.stepsGrid}>
        {steps.map(step => (
          <Card
            key={step.stepNumber}
            padding="lg"
            variant="glass"
            classNameOverride={styles.stepCard}
          >
            <div className={styles.stepBadge}>{step.stepNumber}</div>
            <Typography
              variant="h3"
              as="h3"
              classNameOverride={styles.stepTitle}
            >
              {step.title}
            </Typography>
            <Typography
              variant="caption"
              color="muted"
              classNameOverride={styles.stepDesc}
            >
              {step.description}
            </Typography>
          </Card>
        ))}
      </div>
    </section>
  );
}
