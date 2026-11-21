import type {Meta, StoryObj} from '@storybook/react';

import OpenSource from './index';

const meta = {
  title: 'Container/Landing/OpenSource',
  component: OpenSource,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OpenSource>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
