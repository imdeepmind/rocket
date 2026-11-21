import type {Meta, StoryObj} from '@storybook/react';

import Features from './index';

const meta = {
  title: 'Container/Landing/Features',
  component: Features,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Features>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
