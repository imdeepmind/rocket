import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@/app/icons';
import styles from './styles.module.css';

export default function Hero(): React.JSX.Element {
  return (
    <section className={`${styles.w} ${styles.heroSection}`}>
      <div className={styles.heroContent}>
        <div className={styles.heroTag}>
          <span className={styles.tagPulse} />
          Managed backend hosting
        </div>
        <h1 className={styles.heroTitle}>
          Your backend.
          <br />
          Deployed. Managed.
          <br />
          <span className={styles.accent}>Ready.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Deploy and manage your backend APIs without the complexity of managing
          infrastructure. Focus on building your product while Rocket takes care
          of deployment and hosting.
        </p>
        <div className={styles.ctaGroup}>
          <Link className={styles.btn} href="/docs/get-started">
            Get started <ArrowRightIcon />
          </Link>
          <Link className={`${styles.btn} ${styles.ghost}`} href="/docs">
            Explore documentation
          </Link>
        </div>
      </div>

      <div className={styles.heroVisualCol}>
        <div className={`${styles.glass} ${styles.windowCard}`}>
          <div className={styles.windowDots}>
            <span className={styles.windowDot} style={{ background: '#FF5F57' }} />
            <span className={styles.windowDot} style={{ background: '#FEBC2E' }} />
            <span className={styles.windowDot} style={{ background: '#28C840' }} />
          </div>

          <div className={styles.row}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            <div>
              <div className={styles.rowTitle}>Configuration</div>
              <div className={styles.rowSubtitle}>Your deployment is ready</div>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            <div>
              <div className={styles.rowTitle}>Provisioning infrastructure</div>
              <div className={styles.rowSubtitle}>Resources set up</div>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.spinner} aria-hidden="true" />
            <div>
              <div className={styles.rowTitle}>Deploying service</div>
              <div className={styles.rowSubtitle}>This may take a minute…</div>
            </div>
          </div>

          <div className={`${styles.row} ${styles.successRow}`}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            <div>
              <div className={styles.successTitle}>Deployment successful</div>
              <div className={styles.successSubtitle}>Your API is live</div>
            </div>
          </div>
        </div>

        <div className={`${styles.mono} ${styles.floatingCard}`}>
          <div className={styles.endpointLabel}>API endpoint</div>
          <div className={styles.endpointUrl}>https://api.rocket.dev</div>
        </div>
      </div>
    </section>
  );
}

