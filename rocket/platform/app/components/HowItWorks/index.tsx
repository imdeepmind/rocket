import React from 'react';
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
      <div className={styles.eyebrow}>How it works</div>
      <h2 className={styles.title}>
        From configuration to production in a few steps.
      </h2>
      <div className={styles.howGrid}>
        <div className={styles.howLine} />
        {STEPS.map((step) => (
          <div key={step.num} className={styles.stepCard}>
            <div className={styles.howStepNum}>{step.num}</div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDescription}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

