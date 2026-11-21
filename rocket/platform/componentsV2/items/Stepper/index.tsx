import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';

import CheckIcon from '@/icons/CheckIcon';

import styles from './styles.module.css';

export interface StepItem {
  title: string;
  subtitle?: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: StepItem[];
  currentStep: number; // 1-indexed
  onStepClick?: (stepIndex: number) => void;
  classNameOverride?: string;
}

export default function Stepper({
  steps,
  currentStep,
  onStepClick,
  classNameOverride,
  ...props
}: StepperProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.stepperCard;

  return (
    <Card
      variant="glass"
      radius="2xl"
      padding="none"
      classNameOverride={combinedClass}
      {...props}
    >
      <Box classNameOverride={styles.stepperContainer}>
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          const badgeClasses = [
            styles.badge,
            isActive ? styles.badgeActive : '',
            isCompleted ? styles.badgeCompleted : '',
            isUpcoming ? styles.badgeUpcoming : '',
          ]
            .filter(Boolean)
            .join(' ');

          const isClickable = Boolean(onStepClick && isCompleted);

          return (
            <React.Fragment key={step.title}>
              {index > 0 && (
                <Box classNameOverride={styles.stepLine} aria-hidden="true" />
              )}

              <Box
                classNameOverride={[
                  styles.stepItem,
                  isClickable ? styles.clickable : '',
                ].join(' ')}
                onClick={() => isClickable && onStepClick?.(stepNumber)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
              >
                <Box classNameOverride={badgeClasses}>
                  {isCompleted ? (
                    <CheckIcon
                      width={15}
                      height={15}
                      stroke="currentColor"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Typography as="span" weight="bold">
                      {stepNumber}
                    </Typography>
                  )}
                </Box>

                <Flex
                  direction="column"
                  gap="0"
                  classNameOverride={styles.textCol}
                >
                  <Typography
                    variant="body-sm"
                    weight={isActive ? 'semibold' : 'medium'}
                    color={
                      isActive ? 'white' : isCompleted ? 'default' : 'muted'
                    }
                  >
                    {step.title}
                  </Typography>
                  {step.subtitle && (
                    <Typography variant="caption" color="muted">
                      {step.subtitle}
                    </Typography>
                  )}
                </Flex>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>
    </Card>
  );
}
