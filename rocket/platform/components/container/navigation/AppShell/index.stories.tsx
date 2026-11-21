import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from '@/components/bits/Typography';

import AppShell from './index';

const meta = {
  title: 'Container/Navigation/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    children: null,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell>
      <div style={{maxWidth: '800px'}}>
        <Typography variant="h1">Dashboard Content Area</Typography>
        <Typography variant="body" color="muted">
          This shell manages the layout, sidebar toggle, navbar notifications,
          and scrollable content area.
        </Typography>
      </div>
    </AppShell>
  ),
};
