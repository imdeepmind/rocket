import type {Meta, StoryObj} from '@storybook/react';

import AmbientBackground from './index';

const meta: Meta<typeof AmbientBackground> = {
  title: 'Bits/AmbientBackground',
  component: AmbientBackground,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AmbientBackground>;

export const Default: Story = {};
