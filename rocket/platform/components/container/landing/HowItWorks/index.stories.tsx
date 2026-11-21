import type {Meta, StoryObj} from '@storybook/react';

import HowItWorks from './index';

const meta = {
  title: 'Container/Landing/HowItWorks',
  component: HowItWorks,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HowItWorks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
