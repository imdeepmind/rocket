import type {Meta, StoryObj} from '@storybook/react';

import ProjectsPreview from './index';

const meta = {
  title: 'Container/Landing/ProjectsPreview',
  component: ProjectsPreview,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
