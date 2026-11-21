import type {Meta, StoryObj} from '@storybook/react';

import WhyRocket from './index';

const meta = {
  title: 'Container/Landing/WhyRocket',
  component: WhyRocket,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WhyRocket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
