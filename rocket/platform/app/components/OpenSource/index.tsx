import React from 'react';
import { ArrowRightIcon } from '@/app/icons';
import styles from './styles.module.css';

const ROSS_FEATURES = [
  'Database schema generation',
  'RESTful routing',
  'Authentication',
  'Request validation',
  'Interactive documentation',
];

export default function OpenSource(): React.JSX.Element {
  return (
    <section className={`${styles.w} ${styles.openSection}`}>
      {/* Left: About ROSS and Rocket */}
      <div className={styles.openInfoCol}>
        <div className={styles.eyebrow}>Built on open source</div>
        <h2 className={styles.title}>Rocket is built on ROSS.</h2>
        <p className={styles.description}>
          ROSS, Rocket Open Source Software, also known as Rocket Core, is a
          configuration-driven API framework that automates the standard
          engineering tasks of backend development. Define your models in
          structured JSON and ROSS does the rest.
        </p>
        <p className={styles.descriptionSecondary}>
          Rocket takes that same ROSS configuration and turns it into a live,
          hosted API, with the database and deployment handled for you. Prefer to
          run it yourself? ROSS is open source, so you can start there and move to
          Rocket whenever you want hosting off your plate.
        </p>
        <div className={styles.ctaGroup}>
          <a
            className={styles.btn}
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            Deploy your ROSS config <ArrowRightIcon />
          </a>
          <a
            className={`${styles.btn} ${styles.ghost}`}
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
          >
            View ROSS on GitHub
          </a>
        </div>
      </div>

      {/* Right: ROSS handles card */}
      <div className={`${styles.glass} ${styles.configCardCol}`}>
        <div className={`${styles.mono} ${styles.configHeader}`}>
          One JSON configuration. ROSS handles:
        </div>
        <div className={styles.rowList}>
          {ROSS_FEATURES.map((item) => (
            <div key={item} className={styles.row}>
              <span className={styles.dot} aria-hidden="true">
                ✓
              </span>
              <span className={styles.rowText}>{item}</span>
            </div>
          ))}
        </div>
        <div className={styles.cardFooterNote}>
          Bring your ROSS configuration. Rocket deploys it with PostgreSQL and
          Redis/Memcached included.
        </div>
      </div>
    </section>
  );
}

