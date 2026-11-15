import React from 'react';
import Link from 'next/link';
import styles from './styles.module.css';

export default function NextStep(): React.JSX.Element {
  return (
    <section className={styles.nextSection}>
      <div className={styles.nextGlow} aria-hidden="true" />
      <div className={`${styles.w} ${styles.contentWrapper}`}>
        <h2 className={styles.title}>
          Ship your backend. Not your infrastructure headaches.
        </h2>
        <p className={styles.description}>
          Get your backend deployed and focus on what matters: building your
          product.
        </p>
        <div className={styles.ctaGroup}>
          <Link className={styles.btn} href="/docs/get-started">
            Get started
          </Link>
          <Link className={`${styles.btn} ${styles.ghost}`} href="/docs">
            Read the documentation
          </Link>
        </div>
      </div>
    </section>
  );
}

