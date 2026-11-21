import type {Meta, StoryObj} from '@storybook/react';

import NextStep from './index';

const meta = {
  title: 'Container/Landing/NextStep',
  component: NextStep,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NextStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
