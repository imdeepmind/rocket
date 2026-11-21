'use client';

import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Stepper, {type StepItem} from '@/componentsV2/items/Stepper';

export const CREATE_PROJECT_STEPS: StepItem[] = [
  {title: 'Upload config', subtitle: 'Add your ZIP'},
  {title: 'Configure', subtitle: 'Set up your app'},
  {title: 'Review & deploy', subtitle: 'Confirm and launch'},
];

export interface CreateProjectStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (stepIndex: 1 | 2 | 3) => void;
  classNameOverride?: string;
}

export default function CreateProjectStepper({
  currentStep,
  onStepClick,
  classNameOverride,
}: CreateProjectStepperProps): React.JSX.Element {
  return (
    <Box maxW="1080" mx="auto" fullWidth classNameOverride={classNameOverride}>
      <Stepper
        steps={CREATE_PROJECT_STEPS}
        currentStep={currentStep}
        onStepClick={stepIdx => {
          if (stepIdx >= 1 && stepIdx <= 3) {
            onStepClick?.(stepIdx as 1 | 2 | 3);
          }
        }}
      />
    </Box>
  );
}
