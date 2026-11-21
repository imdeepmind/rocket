'use client';

import React, {useEffect, useRef, useState} from 'react';

import MoreHorizontalIcon from '@/icons/MoreHorizontalIcon';

import IconButton from '@/componentsV2/bits/IconButton';

import styles from './styles.module.css';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface ActionMenuProps {
  trigger?: React.ReactNode;
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  classNameOverride?: string;
}

export default function ActionMenu({
  trigger,
  items,
  align = 'right',
  classNameOverride,
}: ActionMenuProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const defaultTrigger = (
    <IconButton
      icon={<MoreHorizontalIcon width={16} height={16} />}
      aria-label="Actions"
      size="sm"
      variant="ghost"
      onClick={() => setIsOpen(prev => !prev)}
    />
  );

  const menuClasses = [
    styles.menu,
    align === 'right' ? styles.alignRight : styles.alignLeft,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={classNameOverride ?? styles.container}>
      <div onClick={() => setIsOpen(prev => !prev)}>
        {trigger ?? defaultTrigger}
      </div>

      {isOpen && (
        <div className={menuClasses} role="menu">
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={[
                styles.item,
                item.danger ? styles.danger : '',
                item.disabled ? styles.disabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setIsOpen(false);
                item.onClick();
              }}
            >
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
