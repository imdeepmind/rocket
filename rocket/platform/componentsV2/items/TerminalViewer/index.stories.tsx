import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import TerminalViewer from './index';

const meta = {
  title: 'Items/TerminalViewer',
  component: TerminalViewer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TerminalViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeploymentLog: Story = {
  args: {
    title: 'Deployment log — blog-backend',
    activeCursor: true,
    lines: [
      '10:42:01 Validating configuration...',
      '10:42:03 Configuration is valid',
      '10:42:04 Provisioning PostgreSQL...',
      '10:42:06 Provisioning Redis...',
      '10:42:08 Waiting for database to accept connections',
    ],
  },
  render: args => (
    <div style={{width: '520px'}}>
      <TerminalViewer {...args} />
    </div>
  ),
};

export const CliCommandPreview: Story = {
  args: {
    title: 'bash — 80x24',
    showDots: true,
    lines: [
      '# Deploy your ROSS API in one command',
      '$ rocket deploy --project blog-backend',
      '✓ Deployed successfully in 42s',
      '→ Live at https://blog-backend.rocket.app',
    ],
  },
  render: args => (
    <div style={{width: '520px'}}>
      <TerminalViewer {...args} />
    </div>
  ),
};
