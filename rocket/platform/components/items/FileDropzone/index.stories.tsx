import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import FileDropzone, {SelectedFile} from './index';

const meta = {
  title: 'Items/FileDropzone',
  component: FileDropzone,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
  render: () => (
    <div style={{width: '540px'}}>
      <FileDropzone
        accept=".zip"
        maxSizeText=".zip up to 50 MB"
        onFileSelect={file => alert(`Selected: ${file.name}`)}
      />
    </div>
  ),
};

function FileDropzoneWithState(): React.JSX.Element {
  const [file, setFile] = useState<SelectedFile | null>({
    name: 'blog-backend.zip',
    size: '2.4 MB',
  });

  return (
    <div style={{width: '540px'}}>
      <FileDropzone
        file={file}
        onFileSelect={f =>
          setFile({
            name: f.name,
            size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
          })
        }
        onFileRemove={() => setFile(null)}
      />
    </div>
  );
}

export const WithSelectedFile: Story = {
  render: () => <FileDropzoneWithState />,
};
