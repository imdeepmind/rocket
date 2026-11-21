import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Card from '@/componentsV2/bits/Card';
import Typography from '@/componentsV2/bits/Typography';

import CheckIcon from '@/icons/CheckIcon';

import styles from './styles.module.css';

export interface OptionCardItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface OptionCardGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  options: OptionCardItem[];
  value: string;
  onChange: (id: string) => void;
  columns?: number;
  classNameOverride?: string;
}

export default function OptionCardGroup({
  options,
  value,
  onChange,
  columns = 3,
  classNameOverride,
  ...props
}: OptionCardGroupProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.grid;

  return (
    <Box
      classNameOverride={combinedClass}
      style={{gridTemplateColumns: `repeat(${columns}, 1fr)`}}
      role="radiogroup"
      {...props}
    >
      {options.map(option => {
        const isSelected = option.id === value;

        const cardClasses = [
          styles.optionCard,
          isSelected ? styles.selected : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <Card
            key={option.id}
            padding="sm"
            variant="interactive"
            classNameOverride={cardClasses}
            onClick={() => onChange(option.id)}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                onChange(option.id);
              }
            }}
          >
            {isSelected && (
              <Box
                as="span"
                classNameOverride={styles.checkIcon}
                aria-hidden="true"
              >
                <CheckIcon
                  width={16}
                  height={16}
                  stroke="currentColor"
                  strokeWidth={2.5}
                />
              </Box>
            )}
            <Typography
              variant="body"
              weight="bold"
              classNameOverride={styles.title}
            >
              {option.title}
            </Typography>
            {option.subtitle && (
              <Typography variant="caption" color="muted">
                {option.subtitle}
              </Typography>
            )}
          </Card>
        );
      })}
    </Box>
  );
}
