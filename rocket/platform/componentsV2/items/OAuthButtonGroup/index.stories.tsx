import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Box from '@/componentsV2/bits/Box';

import OAuthButtonGroup from './index';

const meta = {
  title: 'Items/OAuthButtonGroup',
  component: OAuthButtonGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    dividerText: {
      control: 'text',
    },
  },
} satisfies Meta<typeof OAuthButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dividerText: 'or continue with email',
  },
  render: args => (
    <Box style={{width: '360px'}}>
      <OAuthButtonGroup {...args} />
    </Box>
  ),
};

export const WithNotice: Story = {
  args: {
    dividerText: 'or continue with email',
    notice: 'Google OAuth configuration is pending deployment.',
    onDismissNotice: () => alert('Notice dismissed'),
  },
  render: args => (
    <Box style={{width: '360px'}}>
      <OAuthButtonGroup {...args} />
    </Box>
  ),
};
