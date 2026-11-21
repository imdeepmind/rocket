'use client';

import React from 'react';

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
  const containerClasses = [styles.tablist, classNameOverride]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="tablist">
      {items.map(item => {
        const isActive = activeKey === item.key;
        const tabClasses = [styles.tab, isActive ? styles.tabActive : '']
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={tabClasses}
            onClick={() => onChange(item.key)}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={styles.badge}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
