import React from 'react';
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
        <div className={styles.comment}># Deploy with just a few lines</div>
        <div className={styles.command}>
          <span className={styles.prompt}>$</span> rocket deploy --project my-app
        </div>
        <div className={styles.success}>✓ Deployed successfully in 42s</div>
      </div>

      {/* Right: Why Rocket info */}
      <div className={styles.infoCol}>
        <div className={styles.eyebrow}>Why Rocket</div>
        <h2 className={styles.title}>
          Spend less time managing infrastructure.
        </h2>
        <ul className={styles.checkList}>
          {BENEFITS.map((benefit) => (
            <li key={benefit} className={styles.checkItem}>
              <span className={styles.checkDot} aria-hidden="true">
                ✓
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

