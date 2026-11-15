import React from 'react';
import Text from '@/app/components/bits/Text';
import styles from './styles.module.css';

const BENEFITS = [
  'Less infrastructure setup',
  'Simplified deployment lifecycle',
  'Centralized deployment management',
  'A straightforward developer experience',
  'PostgreSQL and Redis/Memcached included',
];

export default function WhyRocket(): React.JSX.Element {
  return (
    <section id="docs" className={`${styles.w} ${styles.whySection}`}>
      {/* Left: CLI terminal preview */}
      <div className={`${styles.glass} ${styles.mono} ${styles.terminalCol}`}>
        <div className={styles.windowDots}>
          <span className={styles.windowDot} style={{ background: '#FF5F57' }} />
          <span className={styles.windowDot} style={{ background: '#FEBC2E' }} />
          <span className={styles.windowDot} style={{ background: '#28C840' }} />
        </div>
        <Text as="div" variant="mono" color="muted" className={styles.comment}>
          # Deploy with just a few lines
        </Text>
        <Text as="div" variant="mono" color="white" className={styles.command}>
          <span className={styles.prompt}>$</span> rocket deploy --project my-app
        </Text>
        <Text as="div" variant="mono" className={styles.success}>
          ✓ Deployed successfully in 42s
        </Text>
      </div>

      {/* Right: Why Rocket info */}
      <div className={styles.infoCol}>
        <Text variant="eyebrow" className={styles.eyebrow}>
          Why Rocket
        </Text>
        <Text as="h2" variant="h2" className={styles.title}>
          Spend less time managing infrastructure.
        </Text>
        <ul className={styles.checkList}>
          {BENEFITS.map((benefit) => (
            <li key={benefit} className={styles.checkItem}>
              <span className={styles.checkDot} aria-hidden="true">
                ✓
              </span>
              <Text as="span" variant="body">
                {benefit}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
