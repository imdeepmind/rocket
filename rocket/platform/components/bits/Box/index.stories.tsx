import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Box, {type BoxProps} from '@/components/bits/Box';
import Typography from '@/components/bits/Typography';

const meta = {
  title: 'Bits/Box',
  component: Box,
  parameters: {
    layout: 'padded',
  },
  args: {
    as: 'div',
    children: 'This is a Box layout component',
  },
} satisfies Meta<BoxProps>;

export default meta;
type Story = StoryObj<BoxProps>;

export const Default: Story = {
  render: () => (
    <Box>
      <Typography variant="body">Box rendered as default div</Typography>
    </Box>
  ),
};

export const CustomElement: Story = {
  render: () => (
    <Box as="section">
      <Typography variant="h3">Box rendered as a section</Typography>
      <Typography variant="body" color="muted">
        Polymorphic container primitive replacing raw HTML tags.
      </Typography>
    </Box>
  ),
};
