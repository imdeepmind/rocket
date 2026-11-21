import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

import Button from '@/componentsV2/bits/Button';
import Typography from '@/componentsV2/bits/Typography';
import WindowFrame from '@/componentsV2/bits/WindowFrame';

import styles from './styles.module.css';

export interface HeroPreviewStep {
  title: string;
  subtitle: string;
  status: 'completed' | 'in-progress' | 'waiting';
}

export const DEFAULT_PREVIEW_STEPS: HeroPreviewStep[] = [
  {
    title: 'Configuration',
    subtitle: 'Your deployment is ready',
    status: 'completed',
  },
  {
    title: 'Provisioning infrastructure',
    subtitle: 'Resources set up',
    status: 'completed',
  },
  {
    title: 'Deploying services',
    subtitle: 'Deployment in progress',
    status: 'in-progress',
  },
];

export interface HeroProps {
  badgeText?: string;
  title?: React.ReactNode;
  subtitle?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  previewSteps?: HeroPreviewStep[];
  classNameOverride?: string;
}

export default function Hero({
  badgeText = 'Managed backend hosting',
  title,
  subtitle = 'Deploy and manage your backend APIs without the complexity of managing infrastructure. Focus on building your product while Rocket takes care of deployment and hosting.',
  primaryCtaText = 'Get started',
  primaryCtaHref = '/auth/sign-up',
  secondaryCtaText = 'Explore documentation',
  secondaryCtaHref = '/docs',
  previewSteps = DEFAULT_PREVIEW_STEPS,
  classNameOverride,
}: HeroProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.heroSection;

  return (
    <section className={combinedClass}>
      <div className={styles.heroContent}>
        {badgeText && (
          <div className={styles.heroTag}>
            <span className={styles.tagPulse} aria-hidden="true" />
            <Typography variant="caption" color="white" as="span">
              {badgeText}
            </Typography>
          </div>
        )}

        <Typography variant="hero" as="h1" classNameOverride={styles.heroTitle}>
          {title ?? (
            <>
              Your backend.
              <br />
              Deployed. Managed.
              <br />
              <span className={styles.accent}>Ready.</span>
            </>
          )}
        </Typography>

        <Typography variant="lead" classNameOverride={styles.heroSubtitle}>
          {subtitle}
        </Typography>

        <div className={styles.ctaGroup}>
          <Button
            href={primaryCtaHref}
            size="lg"
            variant="primary"
            rightIcon={<ArrowRightIcon width={16} height={16} />}
          >
            {primaryCtaText}
          </Button>
          <Button href={secondaryCtaHref} size="lg" variant="ghost">
            {secondaryCtaText}
          </Button>
        </div>
      </div>

      <div className={styles.heroVisualCol}>
        <WindowFrame
          title="deployment.status"
          classNameOverride={styles.windowCard}
        >
          <div className={styles.stepsList}>
            {previewSteps.map((step, idx) => (
              <div key={idx} className={styles.stepRow}>
                {step.status === 'completed' ? (
                  <span className={styles.dotSuccess} aria-hidden="true">
                    ✓
                  </span>
                ) : step.status === 'in-progress' ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <span className={styles.dotWaiting} aria-hidden="true" />
                )}
                <div>
                  <Typography variant="body-sm" weight="semibold">
                    {step.title}
                  </Typography>
                  <Typography variant="caption" color="muted">
                    {step.subtitle}
                  </Typography>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cardFooter}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <Typography variant="caption" color="muted">
              Monitoring active on us-east-1
            </Typography>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}
