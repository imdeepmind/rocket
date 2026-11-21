import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';

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
              <Tag variant="neutral" size="md" dot>
                <Typography variant="caption" color="white" as="span">
                  {badgeText}
                </Typography>
              </Tag>
            </Box>
          )}

          <Typography variant="hero" as="h1">
            {title ?? (
              <>
                Your backend.
                <br />
                Deployed. Managed.
                <br />
                <Typography variant="hero" as="span" color="accent">
                  Ready.
                </Typography>
              </>
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

        <Box flex="1" minW="0" basis="440">
          <WindowFrame title="deployment.status" variant="glass">
            <Flex direction="column" gap="3" py="3" px="1">
              {previewSteps.map((step, idx) => (
                <Card key={idx} padding="sm" variant="subtle">
                  <Flex align="center" gap="3">
                    {step.status === 'completed' ? (
                      <IconBadge variant="success" size="sm" rounded="full">
                        ✓
                      </IconBadge>
                    ) : step.status === 'in-progress' ? (
                      <StatusDot variant="loading" size="lg" />
                    ) : (
                      <IconBadge variant="surface" size="sm" rounded="full" />
                    )}
                    <Flex direction="column">
                      <Typography variant="body-sm" weight="semibold">
                        {step.title}
                      </Typography>
                      <Typography variant="caption" color="muted">
                        {step.subtitle}
                      </Typography>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>

            <Flex align="center" gap="2" mt="3" pt="3" borderTop>
              <StatusDot variant="success" size="sm" pulse />
              <Typography variant="caption" color="muted">
                Monitoring active on us-east-1
              </Typography>
            </Flex>
          </WindowFrame>
        </Box>
      </Flex>
    </Section>
  );
}
