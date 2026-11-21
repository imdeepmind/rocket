'use client';

import React from 'react';

import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  classNameOverride?: string;
}

export default function Tabs({
  items,
  activeKey,
  onChange,
  classNameOverride,
}: TabsProps): React.JSX.Element {
  return (
    <Flex
      align="center"
      gap="1"
      classNameOverride={classNameOverride ?? styles.tablist}
      role="tablist"
    >
      {items.map(item => {
        const isActive = activeKey === item.key;
        const tabClasses = [styles.tab, isActive ? styles.tabActive : '']
          .filter(Boolean)
          .join(' ');

        return (
          <Flex
            as="button"
            type="button"
            key={item.key}
            role="tab"
            aria-selected={isActive}
            align="center"
            gap="2"
            classNameOverride={tabClasses}
            onClick={() => onChange(item.key)}
          >
            <Typography
              as="span"
              variant="caption"
              weight={isActive ? 'semibold' : 'medium'}
              classNameOverride={styles.tabLabel}
            >
              {item.label}
            </Typography>
            {item.count !== undefined && (
              <Typography
                as="span"
                variant="caption"
                classNameOverride={styles.badge}
              >
                {item.count}
              </Typography>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}
