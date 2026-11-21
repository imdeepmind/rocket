import type {Meta, StoryObj} from '@storybook/react';

import SettingsForm, {
  type SettingsFormProps,
} from '@/componentsV2/container/dashboard/SettingsForm';

const meta = {
  title: 'Container/Dashboard/SettingsForm',
  component: SettingsForm,
  parameters: {
    layout: 'padded',
  },
  args: {
    initialData: {
      workspaceName: 'Abhishek Workspace',
      region: 'us-east-1',
    },
    onSave: () => {},
    onDeleteWorkspace: () => {},
    isSaving: false,
    saveSuccess: false,
  },
} satisfies Meta<SettingsFormProps>;

export default meta;
type Story = StoryObj<SettingsFormProps>;

export const Default: Story = {};

export const Saving: Story = {
  args: {
    isSaving: true,
  },
};

export const SaveSuccessState: Story = {
  args: {
    saveSuccess: true,
  },
};
