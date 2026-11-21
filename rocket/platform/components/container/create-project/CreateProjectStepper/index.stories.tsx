import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import CreateProjectStepper, {type CreateProjectStepperProps} from './index';

const meta = {
  title: 'Container/CreateProject/CreateProjectStepper',
  component: CreateProjectStepper,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<CreateProjectStepperProps>;

export default meta;
type Story = StoryObj<CreateProjectStepperProps>;

function InteractiveStepper() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(2);

  return (
    <CreateProjectStepper
      currentStep={step}
      onStepClick={newStep => setStep(newStep)}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveStepper />,
};

export const Step1: Story = {
  args: {
    currentStep: 1,
  },
};

export const Step2: Story = {
  args: {
    currentStep: 2,
  },
};

export const Step3: Story = {
  args: {
    currentStep: 3,
  },
};

export const Step4: Story = {
  args: {
    currentStep: 4,
  },
};
