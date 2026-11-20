import React from 'react';

import Button from '@/app/components/bits/Button';
import Text from '@/app/components/bits/Text';

import {ArrowRightIcon} from '@/app/icons';

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
        <Text variant="eyebrow" className={styles.eyebrow}>
          Built on open source
        </Text>
        <Text as="h2" variant="h2" className={styles.title}>
          Rocket is built on ROSS.
        </Text>
        <Text as="p" variant="lead" className={styles.description}>
          ROSS, Rocket Open Source Software, also known as Rocket Core, is a
          configuration-driven API framework that automates the standard
          engineering tasks of backend development. Define your models in
          structured JSON and ROSS does the rest.
        </Text>
        <Text
          as="p"
          variant="body"
          color="muted"
          className={styles.descriptionSecondary}
        >
          Rocket takes that same ROSS configuration and turns it into a live,
          hosted API, with the database and deployment handled for you. Prefer
          to run it yourself? ROSS is open source, so you can start there and
          move to Rocket whenever you want hosting off your plate.
        </Text>
        <div className={styles.ctaGroup}>
          <Button
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            variant="primary"
          >
            Deploy your ROSS config <ArrowRightIcon />
          </Button>
          <Button
            href="https://github.com/imdeepmind/rocket"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            variant="ghost"
          >
            View ROSS on GitHub
          </Button>
        </div>
      </div>

      {/* Right: ROSS handles card */}
      <div className={`${styles.glass} ${styles.configCardCol}`}>
        <Text
          as="div"
          variant="mono"
          color="muted"
          className={styles.configHeader}
        >
          One JSON configuration. ROSS handles:
        </Text>
        <div className={styles.rowList}>
          {ROSS_FEATURES.map(item => (
            <div key={item} className={styles.row}>
              <span className={styles.dot} aria-hidden="true">
                ✓
              </span>
              <Text as="span" variant="body" className={styles.rowText}>
                {item}
              </Text>
            </div>
          ))}
        </div>
        <Text
          as="div"
          variant="caption"
          color="muted"
          className={styles.cardFooterNote}
        >
          Bring your ROSS configuration. Rocket deploys it with PostgreSQL and
          Redis/Memcached included.
        </Text>
      </div>
    </section>
  );
}
