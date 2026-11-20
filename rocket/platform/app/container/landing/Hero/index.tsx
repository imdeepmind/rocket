import React from 'react';

import Button from '@/app/components/bits/Button';
import Text from '@/app/components/bits/Text';

import {ArrowRightIcon} from '@/app/icons';

import styles from './styles.module.css';

export default function Hero(): React.JSX.Element {
  return (
    <section className={`${styles.w} ${styles.heroSection}`}>
      <div className={styles.heroContent}>
        <div className={styles.heroTag}>
          <span className={styles.tagPulse} />
          <Text as="span" variant="caption" color="white">
            Managed backend hosting
          </Text>
        </div>
        <Text as="h1" variant="hero" className={styles.heroTitle}>
          Your backend.
          <br />
          Deployed. Managed.
          <br />
          <span className={styles.accent}>Ready.</span>
        </Text>
        <Text as="p" variant="lead" className={styles.heroSubtitle}>
          Deploy and manage your backend APIs without the complexity of managing
          infrastructure. Focus on building your product while Rocket takes care
          of deployment and hosting.
        </Text>
        <div className={styles.ctaGroup}>
          <Button href="/docs/get-started" size="lg" variant="primary">
            Get started <ArrowRightIcon />
          </Button>
          <Button href="/docs" size="lg" variant="ghost">
            Explore documentation
          </Button>
        </div>
      </div>

      <div className={styles.heroVisualCol}>
        <div className={`${styles.glass} ${styles.windowCard}`}>
          <div className={styles.windowDots}>
            <span
              className={styles.windowDot}
              style={{background: '#FF5F57'}}
            />
            <span
              className={styles.windowDot}
              style={{background: '#FEBC2E'}}
            />
            <span
              className={styles.windowDot}
              style={{background: '#28C840'}}
            />
          </div>

          <div className={styles.row}>
            <span className={styles.dot} aria-hidden="true">
              ✓
            </span>
            <div>
              <Text as="div" weight="semibold" className={styles.rowTitle}>
                Configuration
              </Text>
              <Text
                as="div"
                variant="caption"
                color="muted"
                className={styles.rowSubtitle}
              >
                Your deployment is ready
              </Text>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.dot} aria-hidden="true">
              ✓
            </span>
            <div>
              <Text as="div" weight="semibold" className={styles.rowTitle}>
                Provisioning infrastructure
              </Text>
              <Text
                as="div"
                variant="caption"
                color="muted"
                className={styles.rowSubtitle}
              >
                Resources set up
              </Text>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.spinner} aria-hidden="true" />
            <div>
              <Text as="div" weight="semibold" className={styles.rowTitle}>
                Deploying service
              </Text>
              <Text
                as="div"
                variant="caption"
                color="muted"
                className={styles.rowSubtitle}
              >
                This may take a minute…
              </Text>
            </div>
          </div>

          <div className={`${styles.row} ${styles.successRow}`}>
            <span className={styles.dot} aria-hidden="true">
              ✓
            </span>
            <div>
              <Text as="div" weight="semibold" className={styles.successTitle}>
                Deployment successful
              </Text>
              <Text
                as="div"
                variant="caption"
                color="muted"
                className={styles.successSubtitle}
              >
                Your API is live
              </Text>
            </div>
          </div>
        </div>

        <div className={`${styles.mono} ${styles.floatingCard}`}>
          <Text
            as="div"
            variant="caption"
            color="muted"
            className={styles.endpointLabel}
          >
            API endpoint
          </Text>
          <Text
            as="div"
            variant="mono"
            color="white"
            className={styles.endpointUrl}
          >
            https://api.rocket.dev
          </Text>
        </div>
      </div>
    </section>
  );
}
