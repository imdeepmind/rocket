import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Typography from '@/components/bits/Typography';

import WindowFrame from './index';

const meta = {
  title: 'Bits/WindowFrame',
  component: WindowFrame,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
    },
    dots: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof WindowFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'bash — 80x24',
    children: (
      <div>
        <Typography variant="mono" color="muted">
          # Deploy your ROSS API
        </Typography>
        <Typography variant="mono" color="white">
          $ rocket deploy --project blog-backend
        </Typography>
        <Typography variant="mono" color="success">
          ✓ Deployed successfully in 42s
        </Typography>
      </div>
    ),
  },
  render: args => (
    <div style={{width: '420px'}}>
      <WindowFrame {...args} />
    </div>
  ),
};
