import React from 'react';
import { ArrowRightIcon } from '@site/src/icons';
import styles from './styles.module.css';

export default function NextStep(): React.JSX.Element {
  return (
    <section className={styles.nextSection}>
      <div className={styles.nextGlow} />
      <div className={`${styles.w} ${styles.contentWrapper}`}>
        <div className={styles.eyebrow}>Next step</div>
        <h2 className={styles.title}>
          Already built your backend? Deploy it with Rocket.
        </h2>
        <p className={styles.description}>
          Take your ROSS project from local to production with Rocket, the deployment platform for backends.
        </p>
        <a
          className={styles.btn}
          href="https://rocket.imdeepmind.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore Rocket <ArrowRightIcon />
        </a>
      </div>
    </section>
  );
}

