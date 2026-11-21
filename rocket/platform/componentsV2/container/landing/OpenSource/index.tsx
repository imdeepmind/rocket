import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export const DEFAULT_ROSS_FEATURES = [
  'Database schema generation',
  'RESTful routing',
  'Authentication',
  'Request validation',
  'Interactive documentation',
];

export interface OpenSourceProps {
  eyebrow?: string;
  title?: string;
  leadText?: string;
  bodyText?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  features?: string[];
  classNameOverride?: string;
}

export default function OpenSource({
  eyebrow = 'Built on open source',
  title = 'Rocket is built on ROSS.',
  leadText = 'ROSS, Rocket Open Source Software, also known as Rocket Core, is a configuration-driven API framework that automates the standard engineering tasks of backend development. Define your models in structured JSON and ROSS does the rest.',
  bodyText = 'Rocket takes that same ROSS configuration and turns it into a live, hosted API, with the database and deployment handled for you. Prefer to run it yourself? ROSS is open source, so you can start there and move to Rocket whenever you want hosting off your plate.',
  primaryCtaText = 'Deploy your ROSS config',
  primaryCtaHref = 'https://github.com/imdeepmind/rocket',
  secondaryCtaText = 'View ROSS on GitHub',
  secondaryCtaHref = 'https://github.com/imdeepmind/rocket',
  features = DEFAULT_ROSS_FEATURES,
  classNameOverride,
}: OpenSourceProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.openSection;

  return (
    <section className={combinedClass}>
      {/* Left: About ROSS and Rocket */}
      <div className={styles.infoCol}>
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="h2" as="h2" classNameOverride={styles.title}>
          {title}
        </Typography>

        <Typography variant="lead" classNameOverride={styles.leadText}>
          {leadText}
        </Typography>

        <Typography
          variant="body"
          color="muted"
          classNameOverride={styles.bodyText}
        >
          {bodyText}
        </Typography>

        <div className={styles.ctaGroup}>
          <Button
            href={primaryCtaHref}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            variant="primary"
            rightIcon={<ArrowRightIcon width={16} height={16} />}
          >
            {primaryCtaText}
          </Button>
          <Button
            href={secondaryCtaHref}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            variant="ghost"
          >
            {secondaryCtaText}
          </Button>
        </div>
      </div>

      {/* Right: ROSS handles card */}
      <div className={styles.cardCol}>
        <Card
          padding="lg"
          variant="glass"
          classNameOverride={styles.configCard}
        >
          <Typography
            variant="mono"
            color="muted"
            classNameOverride={styles.cardHeader}
          >
            One JSON configuration. ROSS handles:
          </Typography>

          <div className={styles.rowList}>
            {features.map(item => (
              <div key={item} className={styles.row}>
                <span className={styles.checkDot} aria-hidden="true">
                  ✓
                </span>
                <Typography variant="body" as="span">
                  {item}
                </Typography>
              </div>
            ))}
          </div>

          <Typography
            variant="caption"
            color="muted"
            classNameOverride={styles.cardFooter}
          >
            Bring your ROSS configuration. Rocket deploys it with PostgreSQL and
            Redis/Memcached included.
          </Typography>
        </Card>
      </div>
    </section>
  );
}
