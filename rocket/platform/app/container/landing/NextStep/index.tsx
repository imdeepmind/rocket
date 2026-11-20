import React from 'react';

import Button from '@/app/components/bits/Button';
import Text from '@/app/components/bits/Text';

import styles from './styles.module.css';

export default function NextStep(): React.JSX.Element {
  return (
    <section className={styles.nextSection}>
      <div className={styles.nextGlow} aria-hidden="true" />
      <div className={`${styles.w} ${styles.contentWrapper}`}>
        <Text as="h2" variant="h2" className={styles.title}>
          Ship your backend. Not your infrastructure headaches.
        </Text>
        <Text as="p" variant="lead" className={styles.description}>
          Get your backend deployed and focus on what matters: building your
          product.
        </Text>
        <div className={styles.ctaGroup}>
          <Button href="/docs/get-started" size="lg" variant="primary">
            Get started
          </Button>
          <Button href="/docs" size="lg" variant="ghost">
            Read the documentation
          </Button>
        </div>
      </div>
    </section>
  );
}
