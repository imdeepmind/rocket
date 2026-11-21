import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Section, {type SectionProps} from '@/componentsV2/bits/Section';
import Typography from '@/componentsV2/bits/Typography';

const meta = {
  title: 'Bits/Section',
  component: Section,
  parameters: {
    layout: 'padded',
  },
  args: {
    as: 'section',
    children: 'Section container',
  },
} satisfies Meta<SectionProps>;

export default meta;
type Story = StoryObj<SectionProps>;

export const Default: Story = {
  render: () => (
    <Section>
      <Typography variant="h2">Section Title</Typography>
      <Typography variant="body" color="muted">
        Semantic section component for page level content regions.
      </Typography>
    </Section>
  ),
};
