import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from '@/components/bits/Typography';

import Section from './index';

const meta = {
  title: 'Bits/Section',
  component: Section,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LandingContainer: Story = {
  args: {
    container: 'landing',
    spacing: 'lg',
    children: (
      <Typography variant="body">
        Centered landing container content within max-width.
      </Typography>
    ),
  },
};

export const HeroSpacing: Story = {
  args: {
    container: 'landing',
    spacing: 'hero',
    align: 'center',
    children: (
      <Typography variant="h1" as="h1">
        Hero Section Title
      </Typography>
    ),
  },
};
