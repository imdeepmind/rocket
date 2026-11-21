import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Box from '@/components/bits/Box';

import IncludedFeaturesCard, {type IncludedFeaturesCardProps} from './index';

const meta = {
  title: 'Container/CreateProject/IncludedFeaturesCard',
  component: IncludedFeaturesCard,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<IncludedFeaturesCardProps>;

export default meta;
type Story = StoryObj<IncludedFeaturesCardProps>;

export const Default: Story = {
  render: () => (
    <Box maxW="340" fullWidth>
      <IncludedFeaturesCard />
    </Box>
  ),
};
