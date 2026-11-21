'use client';

import React, {useEffect, useState} from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
import IconButton from '@/componentsV2/bits/IconButton';
import Typography from '@/componentsV2/bits/Typography';

import MoreHorizontalIcon from '@/icons/MoreHorizontalIcon';

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest('[data-action-menu]')) {
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

  const menuClasses = [
    styles.menu,
    align === 'right' ? styles.alignRight : styles.alignLeft,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box
      data-action-menu
      position="relative"
      classNameOverride={classNameOverride ?? styles.container}
    >
      <Box
        onClick={e => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
      >
        {trigger ?? (
          <IconButton
            icon={<MoreHorizontalIcon width={16} height={16} />}
            aria-label="Actions"
            size="sm"
            variant="ghost"
          />
        )}
      </Box>

      {isOpen && (
        <Box
          classNameOverride={menuClasses}
          role="menu"
          onClick={e => e.stopPropagation()}
        >
          {items.map(item => (
            <Flex
              key={item.id}
              as="button"
              type="button"
              role="menuitem"
              disabled={item.disabled}
              align="center"
              gap="2"
              classNameOverride={[
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
              {item.icon && (
                <Box as="span" classNameOverride={styles.icon}>
                  {item.icon}
                </Box>
              )}
              <Typography
                as="span"
                variant="caption"
                weight="medium"
                classNameOverride={
                  item.danger ? styles.itemLabelDanger : styles.itemLabel
                }
              >
                {item.label}
              </Typography>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  );
}
