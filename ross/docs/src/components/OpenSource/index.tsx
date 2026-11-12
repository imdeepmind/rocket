import React from 'react';
import styles from './styles.module.css';

export default function OpenSource(): React.JSX.Element {
  return (
    <section id="open" className={`${styles.w} ${styles.openSection}`}>
      <div className={`${styles.glass} ${styles.mono} ${styles.terminalCol}`}>
        <div className={styles.windowDots}>
          <span className={styles.windowDot} style={{ background: '#FF5F57' }} />
          <span className={styles.windowDot} style={{ background: '#FEBC2E' }} />
          <span className={styles.windowDot} style={{ background: '#28C840' }} />
        </div>
        <div>
          <span className={styles.commandPrompt}>$</span> ross check
        </div>
        <div className={styles.checkList}>
          <div className={`${styles.mono} ${styles.checkItem}`}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            Models processed: 3
          </div>
          <div className={`${styles.mono} ${styles.checkItem}`}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            APIs generated: 12
          </div>
          <div className={`${styles.mono} ${styles.checkItem}`}>
            <span className={styles.dot} aria-hidden="true">✓</span>
            Docs available at /docs
          </div>
        </div>
        <div className={styles.successBanner}>
          ✓ Build completed successfully!
        </div>
      </div>

      <div className={styles.openInfoCol}>
        <div className={styles.eyebrow}>Open source</div>
        <h2 className={styles.title}>
          Built for developers. Backed by a community.
        </h2>
        <p className={styles.description}>
          ROSS is MIT licensed and welcomes contributions from developers like you.
        </p>
        <div className={styles.ctaGroup}>
          <a
            className={styles.btn}
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub ↗
          </a>
          <a
            className={`${styles.btn} ${styles.ghost}`}
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contribute
          </a>
        </div>
      </div>
    </section>
  );
}

