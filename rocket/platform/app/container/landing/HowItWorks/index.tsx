import React from 'react';
import Text from '@/app/components/bits/Text';
import styles from './styles.module.css';

interface Step {
  num: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    title: 'Configure',
    description: 'Provide your backend and deployment requirements.',
  },
  {
    num: 2,
    title: 'Deploy',
    description:
      'Rocket provisions the required infrastructure and deploys your service.',
  },
  {
    num: 3,
    title: 'Manage',
    description:
      'Access your deployed APIs and manage their lifecycle through the platform.',
  },
];

export default function HowItWorks(): React.JSX.Element {
  return (
    <section id="how" className={`${styles.w} ${styles.howSection}`}>
      <Text variant="eyebrow" className={styles.eyebrow}>
        How it works
      </Text>
      <Text as="h2" variant="h2" className={styles.title}>
        From configuration to production in a few steps.
      </Text>
      <div className={styles.howGrid}>
        <div className={styles.howLine} />
        {STEPS.map((step) => (
          <div key={step.num} className={styles.stepCard}>
            <div className={styles.howStepNum}>{step.num}</div>
            <Text as="h3" variant="h3" className={styles.stepTitle}>
              {step.title}
            </Text>
            <Text as="p" variant="caption" color="muted" className={styles.stepDescription}>
              {step.description}
            </Text>
          </div>
        ))}
      </div>
    </section>
  );
}
