import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import StatusDot from '@/componentsV2/bits/StatusDot';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';
import WindowFrame from '@/componentsV2/bits/WindowFrame';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

import styles from './styles.module.css';

export interface HeroPreviewStep {
  title: string;
  subtitle: string;
  status: 'completed' | 'in-progress' | 'waiting' | 'success';
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
    title: 'Deploying service',
    subtitle: 'This may take a minute…',
    status: 'in-progress',
  },
  {
    title: 'Deployment successful',
    subtitle: 'Your API is live',
    status: 'success',
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
  return (
    <Section
      container="landing"
      spacing="hero"
      classNameOverride={classNameOverride}
    >
      <Flex gap="18" align="center" wrap="wrap">
        <Flex direction="column" flex="1" minW="0" basis="460">
          {badgeText && (
            <Box mb="7">
              <Tag variant="neutral" size="md" dot dotColor="success" dotPulse>
                <Typography variant="caption" color="white" as="span">
                  {badgeText}
                </Typography>
              </Tag>
            </Box>
          )}

          <Typography variant="hero" as="h1">
            {title ?? (
              <Flex direction="column">
                <Typography variant="hero" as="span">
                  Your backend.
                </Typography>
                <Typography variant="hero" as="span">
                  Deployed. Managed.
                </Typography>
                <Typography variant="hero" as="span" color="accent">
                  Ready.
                </Typography>
              </Flex>
            )}
          </Typography>

          <Box my="7">
            <Typography variant="lead" maxW="520">
              {subtitle}
            </Typography>
          </Box>

          <Flex gap="3" wrap="wrap">
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
          </Flex>
        </Flex>

        <Box
          flex="1"
          minW="0"
          basis="440"
          position="relative"
          pb="10"
          classNameOverride={styles.visualCol}
        >
          <WindowFrame dots headerBorder={false} variant="glass">
            <Flex direction="column" gap="3">
              {previewSteps.map((step, idx) => {
                const isSuccess = step.status === 'success';
                return (
                  <Card
                    key={idx}
                    variant={isSuccess ? 'success' : 'subtle'}
                    radius="xl"
                    padding="row"
                  >
                    <Flex align="center" gap="4">
                      {step.status === 'completed' || isSuccess ? (
                        <IconBadge
                          variant="success-solid"
                          size="sm"
                          rounded="full"
                        >
                          ✓
                        </IconBadge>
                      ) : step.status === 'in-progress' ? (
                        <StatusDot variant="spinner" size="lg" />
                      ) : (
                        <IconBadge variant="waiting" size="sm" rounded="full" />
                      )}
                      <Flex direction="column">
                        <Typography
                          variant="body-sm"
                          weight="semibold"
                          color={isSuccess ? 'success' : 'white'}
                        >
                          {step.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={isSuccess ? 'success-muted' : 'muted'}
                        >
                          {step.subtitle}
                        </Typography>
                      </Flex>
                    </Flex>
                  </Card>
                );
              })}
            </Flex>
          </WindowFrame>

          <Card
            variant="floating"
            radius="xl"
            padding="floating"
            classNameOverride={styles.floatingCard}
          >
            <Flex direction="column" gap="1">
              <Typography
                variant="caption"
                color="muted"
                transform="uppercase"
                letterSpacing="wide"
              >
                API endpoint
              </Typography>
              <Typography variant="mono" color="white" weight="normal">
                https://rocket.imdeepmind.com
              </Typography>
            </Flex>
          </Card>
        </Box>
      </Flex>
    </Section>
  );
}
