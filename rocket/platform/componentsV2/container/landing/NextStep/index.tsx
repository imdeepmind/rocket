import React from 'react';

import Button from '@/componentsV2/bits/Button';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface NextStepProps {
  title?: string;
  description?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  classNameOverride?: string;
}

export default function NextStep({
  title = 'Ship your backend. Not your infrastructure headaches.',
  description = 'Get your backend deployed and focus on what matters: building your product.',
  primaryCtaText = 'Get started',
  primaryCtaHref = '/docs/get-started',
  secondaryCtaText = 'Read the documentation',
  secondaryCtaHref = '/docs',
  classNameOverride,
}: NextStepProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.nextSection;

  return (
    <section className={combinedClass}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.content}>
        <Typography variant="h2" as="h2" classNameOverride={styles.title}>
          {title}
        </Typography>
        <Typography variant="lead" classNameOverride={styles.description}>
          {description}
        </Typography>
        <div className={styles.ctaGroup}>
          <Button href={primaryCtaHref} size="lg" variant="primary">
            {primaryCtaText}
          </Button>
          <Button href={secondaryCtaHref} size="lg" variant="ghost">
            {secondaryCtaText}
          </Button>
        </div>
      </div>
    </section>
  );
}
