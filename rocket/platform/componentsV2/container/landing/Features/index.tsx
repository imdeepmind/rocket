import React from 'react';

import ActivityIcon from '@/icons/ActivityIcon';
import CodeIcon from '@/icons/CodeIcon';
import LayersIcon from '@/icons/LayersIcon';
import ZapIcon from '@/icons/ZapIcon';

import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Grid from '@/componentsV2/bits/Grid';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Section from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

export interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const DEFAULT_FEATURES: FeatureItem[] = [
  {
    icon: <ZapIcon width={22} height={22} />,
    title: 'Simple deployments',
    description:
      'Deploy your backend services through a straightforward workflow, without manually managing infrastructure.',
  },
  {
    icon: <LayersIcon width={22} height={22} />,
    title: 'Managed infrastructure',
    description:
      'Let Rocket handle the underlying infrastructure, including a managed PostgreSQL database and Redis or Memcached for caching.',
  },
  {
    icon: <ActivityIcon width={22} height={22} />,
    title: 'Deployment management',
    description:
      'Track deployments, monitor their status, and manage your services from one place.',
  },
  {
    icon: <CodeIcon width={22} height={22} />,
    title: 'Built for developers',
    description:
      'A straightforward platform designed around developer workflows, with minimal complexity.',
  },
];

export interface FeaturesProps {
  eyebrow?: string;
  title?: string;
  features?: FeatureItem[];
  classNameOverride?: string;
}

export default function Features({
  eyebrow = 'Platform',
  title = 'Everything you need to get your backend running.',
  features = DEFAULT_FEATURES,
  classNameOverride,
}: FeaturesProps): React.JSX.Element {
  return (
    <Section
      id="features"
      container="landing"
      spacing="lg"
      classNameOverride={classNameOverride}
    >
      <Flex direction="column" gap="3" mb="12">
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="h2" as="h2" maxW="600">
          {title}
        </Typography>
      </Flex>

      <Grid minItemWidth="240" gap="5">
        {features.map(feature => (
          <Card key={feature.title} padding="lg" variant="glass" hoverable>
            <Flex direction="column" gap="3">
              <IconBadge variant="primary" size="lg" rounded="md">
                {feature.icon}
              </IconBadge>
              <Typography variant="h3" as="h3">
                {feature.title}
              </Typography>
              <Typography variant="caption" color="muted">
                {feature.description}
              </Typography>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}
