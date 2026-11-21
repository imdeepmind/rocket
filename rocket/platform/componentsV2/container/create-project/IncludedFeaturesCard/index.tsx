'use client';

import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import Typography from '@/componentsV2/bits/Typography';

import ActivityIcon from '@/icons/ActivityIcon';
import DatabaseIcon from '@/icons/DatabaseIcon';
import LayersIcon from '@/icons/LayersIcon';
import ZapIcon from '@/icons/ZapIcon';

import styles from './styles.module.css';

export interface IncludedFeatureItem {
  icon: React.ReactNode;
  name: string;
  description: string;
}

export const DEFAULT_INCLUDED_FEATURES: IncludedFeatureItem[] = [
  {
    icon: <DatabaseIcon width={18} height={18} stroke="currentColor" />,
    name: 'Managed PostgreSQL',
    description: 'Provisioned automatically',
  },
  {
    icon: <ZapIcon width={18} height={18} stroke="currentColor" />,
    name: 'Managed Redis',
    description: 'Caching layer, no setup',
  },
  {
    icon: <LayersIcon width={18} height={18} stroke="currentColor" />,
    name: 'Server',
    description: 'Dedicated compute instance',
  },
  {
    icon: <ActivityIcon width={18} height={18} stroke="currentColor" />,
    name: 'Analytics',
    description: 'Real-time metrics & insights',
  },
];

export interface IncludedFeaturesCardProps {
  title?: string;
  features?: IncludedFeatureItem[];
  classNameOverride?: string;
}

export default function IncludedFeaturesCard({
  title = 'Included with every project',
  features = DEFAULT_INCLUDED_FEATURES,
  classNameOverride,
}: IncludedFeaturesCardProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.card;

  return (
    <Card
      variant="glass"
      radius="2xl"
      padding="none"
      classNameOverride={combinedClass}
    >
      <Box mb="5">
        <Typography variant="body" weight="semibold" color="white">
          {title}
        </Typography>
      </Box>
      <Flex direction="column" gap="5">
        {features.map((feature, idx) => (
          <Flex align="start" gap="3" key={idx}>
            <IconBadge
              variant="primary"
              size="md"
              rounded="md"
              icon={feature.icon}
            />
            <Flex direction="column" gap="0">
              <Typography variant="body-sm" weight="semibold" color="white">
                {feature.name}
              </Typography>
              <Typography variant="caption" color="muted">
                {feature.description}
              </Typography>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}
