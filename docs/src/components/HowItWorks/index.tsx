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
    description: 'Define your backend using barebone_config.json.',
  },
  {
    num: 2,
    title: 'Generate',
    description: 'Run the CLI to generate your APIs.',
  },
  {
    num: 3,
    title: 'Run',
    description: 'Start your backend and explore your APIs.',
  },
];

export default function HowItWorks(): React.JSX.Element {
  return (
    <section id="how" className={`${styles.w} ${styles.howSection}`}>
      <div className={styles.eyebrow}>How it works</div>
      <h2 className={styles.title}>
        From configuration to running APIs in minutes.
      </h2>
      <div className={styles.howGrid}>
        <div className={styles.howLine} />
        {STEPS.map((step) => (
          <div key={step.num} className={styles.stepCard}>
            <div className={styles.howStepNum}>{step.num}</div>
            <h3 className={styles.stepTitle}>
              {step.title}
            </h3>
            <p className={styles.stepDescription}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

