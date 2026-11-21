import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Card from '@/componentsV2/bits/Card';
import Flex, {type FlexProps} from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';

const meta = {
  title: 'Bits/Flex',
  component: Flex,
  parameters: {
    layout: 'padded',
  },
  args: {
    direction: 'row',
    align: 'center',
    gap: '3',
    children: 'Flex content',
  },
} satisfies Meta<FlexProps>;

export default meta;
type Story = StoryObj<FlexProps>;

export const RowWithGap: Story = {
  render: () => (
    <Flex direction="row" align="center" gap="4">
      <Card padding="sm">
        <Typography variant="body-sm">Item 1</Typography>
      </Card>
      <Card padding="sm">
        <Typography variant="body-sm">Item 2</Typography>
      </Card>
      <Card padding="sm">
        <Typography variant="body-sm">Item 3</Typography>
      </Card>
    </Flex>
  ),
};

export const ColumnCentered: Story = {
  render: () => (
    <Flex direction="column" align="center" gap="3" fullWidth>
      <Typography variant="h3">Centered Column</Typography>
      <Typography variant="body" color="muted">
        Aligned along cross axis with standardized spacing tokens.
      </Typography>
    </Flex>
  ),
};

export const SpaceBetween: Story = {
  render: () => (
    <Flex direction="row" align="center" justify="between" fullWidth>
      <Typography variant="body" weight="semibold">
        Left Title
      </Typography>
      <Typography variant="caption" color="muted">
        Right Detail
      </Typography>
    </Flex>
  ),
};
