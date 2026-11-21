'use client';

import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Stepper, {type StepItem} from '@/componentsV2/items/Stepper';

export const CREATE_PROJECT_STEPS: StepItem[] = [
  {title: 'Upload', subtitle: 'Project ZIP'},
  {title: 'Configure', subtitle: 'Settings & env'},
  {title: 'Review', subtitle: 'Specifications'},
  {title: 'Deploy', subtitle: 'Live execution'},
];

export interface CreateProjectStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (stepIndex: 1 | 2 | 3 | 4) => void;
  classNameOverride?: string;
}

export default function CreateProjectStepper({
  currentStep,
  onStepClick,
  classNameOverride,
}: CreateProjectStepperProps): React.JSX.Element {
  return (
    <Box maxW="840" mx="auto" fullWidth classNameOverride={classNameOverride}>
      <Stepper
        steps={CREATE_PROJECT_STEPS}
        currentStep={currentStep}
        onStepClick={stepIdx => {
          if (stepIdx >= 1 && stepIdx <= 4) {
            onStepClick?.(stepIdx as 1 | 2 | 3 | 4);
          }
        }}
      />
    </Box>
  );
}
