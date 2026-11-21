import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Card from '@/componentsV2/bits/Card';
import Typography from '@/componentsV2/bits/Typography';

import Grid from './index';

const meta = {
  title: 'Bits/Grid',
  component: Grid,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResponsiveAutoFit: Story = {
  args: {
    minItemWidth: '240',
    gap: '4',
  },
  render: args => (
    <Grid {...args}>
      {[1, 2, 3, 4].map(n => (
        <Card key={n} padding="md" variant="glass">
          <Typography variant="body" weight="semibold">
            Item {n}
          </Typography>
        </Card>
      ))}
    </Grid>
  ),
};

export const FixedColumns: Story = {
  args: {
    columns: 3,
    gap: '4',
  },
  render: args => (
    <Grid {...args}>
      {[1, 2, 3].map(n => (
        <Card key={n} padding="md" variant="default">
          <Typography variant="body">Column {n}</Typography>
        </Card>
      ))}
    </Grid>
  ),
};
