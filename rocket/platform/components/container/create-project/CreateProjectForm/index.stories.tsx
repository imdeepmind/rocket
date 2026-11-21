import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import CreateProjectForm, {
  type CreateProjectFormProps,
  type ProjectFormData,
} from './index';

const initialData: ProjectFormData = {
  step: 1,
  file: null,
  projectName: 'blog-backend',
  projectSlug: 'blog-backend',
  memory: '512 MB',
  envVars: [
    {id: '1', key: 'PORT', value: '8080', managed: true},
    {id: '2', key: 'NODE_ENV', value: 'production', managed: true},
    {id: '3', key: 'DATABASE_URL', value: 'postgres://user:pass@db:5432/main'},
  ],
  deployProgress: 48,
  deployStepIndex: 2,
};

const meta = {
  title: 'Container/CreateProject/CreateProjectForm',
  component: CreateProjectForm,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<CreateProjectFormProps>;

export default meta;
type Story = StoryObj<CreateProjectFormProps>;

function InteractiveForm(props: Partial<CreateProjectFormProps>) {
  const [data, setData] = useState<ProjectFormData>(initialData);

  return (
    <CreateProjectForm
      data={data}
      onStepChange={step => setData(prev => ({...prev, step}))}
      onFileSelect={file =>
        setData(prev => ({
          ...prev,
          file: {
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          },
        }))
      }
      onFileRemove={() => setData(prev => ({...prev, file: null}))}
      onProjectNameChange={name =>
        setData(prev => ({...prev, projectName: name}))
      }
      onMemoryChange={memory => setData(prev => ({...prev, memory}))}
      onAddEnvVar={() =>
        setData(prev => ({
          ...prev,
          envVars: [
            ...prev.envVars,
            {id: String(Date.now()), key: '', value: ''},
          ],
        }))
      }
      onUpdateEnvVar={(id, field, val) =>
        setData(prev => ({
          ...prev,
          envVars: prev.envVars.map(v =>
            v.id === id ? {...v, [field]: val} : v,
          ),
        }))
      }
      onRemoveEnvVar={id =>
        setData(prev => ({
          ...prev,
          envVars: prev.envVars.filter(v => v.id !== id),
        }))
      }
      onDeploy={() => setData(prev => ({...prev, step: 4}))}
      {...props}
    />
  );
}

export const Step1Upload: Story = {
  render: () => <InteractiveForm />,
};

export const Step2Configure: Story = {
  render: () => (
    <InteractiveForm
      data={{
        ...initialData,
        step: 2,
        file: {name: 'blog-backend.zip', size: '2.4 MB'},
      }}
    />
  ),
};

export const Step3Review: Story = {
  render: () => (
    <InteractiveForm
      data={{
        ...initialData,
        step: 3,
        file: {name: 'blog-backend.zip', size: '2.4 MB'},
      }}
    />
  ),
};

export const Step4Deploying: Story = {
  render: () => (
    <InteractiveForm
      data={{
        ...initialData,
        step: 4,
        file: {name: 'blog-backend.zip', size: '2.4 MB'},
      }}
    />
  ),
};
