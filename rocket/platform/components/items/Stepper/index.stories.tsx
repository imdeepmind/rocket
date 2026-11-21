import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Stepper from './index';

const WIZARD_STEPS = [
  {title: 'Upload config', subtitle: 'Add your ZIP'},
  {title: 'Configure', subtitle: 'Set up your app'},
  {title: 'Review & deploy', subtitle: 'Confirm and launch'},
];

const meta = {
  title: 'Items/Stepper',
  component: Stepper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    currentStep: {
      control: {type: 'number', min: 1, max: 3, step: 1},
    },
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Step1Active: Story = {
  args: {
    steps: WIZARD_STEPS,
    currentStep: 1,
  },
  render: args => (
    <div style={{width: '680px'}}>
      <Stepper {...args} />
    </div>
  ),
};

export const Step2Active: Story = {
  args: {
    steps: WIZARD_STEPS,
    currentStep: 2,
    onStepClick: step => alert(`Navigate back to step ${step}`),
  },
  render: args => (
    <div style={{width: '680px'}}>
      <Stepper {...args} />
    </div>
  ),
};

export const Step3Active: Story = {
  args: {
    steps: WIZARD_STEPS,
    currentStep: 3,
    onStepClick: step => alert(`Navigate back to step ${step}`),
  },
  render: args => (
    <div style={{width: '680px'}}>
      <Stepper {...args} />
    </div>
  ),
};
