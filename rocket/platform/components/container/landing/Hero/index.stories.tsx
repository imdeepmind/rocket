import type {Meta, StoryObj} from '@storybook/react';

import Hero from './index';

const meta = {
  title: 'Container/Landing/Hero',
  component: Hero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
