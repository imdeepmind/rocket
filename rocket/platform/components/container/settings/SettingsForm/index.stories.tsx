import type {Meta, StoryObj} from '@storybook/react';

import SettingsForm, {type SettingsFormProps} from './index';

const meta = {
  title: 'Container/Settings/SettingsForm',
  component: SettingsForm,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<SettingsFormProps>;

export default meta;
type Story = StoryObj<SettingsFormProps>;

export const Default: Story = {
  args: {},
};
