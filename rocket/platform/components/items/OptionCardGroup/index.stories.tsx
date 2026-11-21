import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import OptionCardGroup from './index';

const MEMORY_OPTIONS = [
  {id: '256 MB', title: '256 MB', subtitle: 'Light APIs'},
  {id: '512 MB', title: '512 MB', subtitle: 'Recommended'},
  {id: '1 GB', title: '1 GB', subtitle: 'High traffic'},
];

const meta = {
  title: 'Items/OptionCardGroup',
  component: OptionCardGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OptionCardGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function MemorySelectionStory(): React.JSX.Element {
  const [selected, setSelected] = useState('512 MB');
  return (
    <div style={{width: '540px'}}>
      <OptionCardGroup
        options={MEMORY_OPTIONS}
        value={selected}
        onChange={setSelected}
      />
    </div>
  );
}

export const MemorySelection: Story = {
  args: {
    options: MEMORY_OPTIONS,
    value: '512 MB',
    onChange: () => {},
  },
  render: () => <MemorySelectionStory />,
};
