import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import CreateProjectWizard, {
  type CreateProjectWizardProps,
  type WizardData,
} from '@/componentsV2/container/dashboard/CreateProjectWizard';

const INITIAL_WIZARD_DATA: WizardData = {
  step: 1,
  file: {name: 'blog-backend.zip', size: '2.4 MB'},
  projectName: 'Blog Backend',
  projectSlug: 'blog-backend',
  envVars: [
    {id: '1', key: 'DATABASE_URL', value: 'Managed by Rocket', managed: true},
    {id: '2', key: 'REDIS_URL', value: 'Managed by Rocket', managed: true},
    {id: '3', key: 'API_SECRET', value: '••••••••••••', managed: false},
  ],
  memory: '512 MB',
  deployStepIndex: 2,
  deployProgress: 48,
  logLines: [
    '$ rocket deploy --source /uploads/blog-backend.zip',
    '✓ Unpacking project archive: blog-backend.zip (2.4 MB)',
    '✓ Parsing ROSS config.json: 4 endpoints detected',
    'ℹ Provisioning 512 MB microcontainer (us-east-1)...',
    'ℹ Injecting 3 environment variables...',
    '⠋ Starting server process on port 8080...',
  ],
};

const meta = {
  title: 'Container/Dashboard/CreateProjectWizard',
  component: CreateProjectWizard,
  parameters: {
    layout: 'padded',
  },
  args: {
    data: INITIAL_WIZARD_DATA,
    onStepChange: () => {},
    onFileSelect: () => {},
    onFileRemove: () => {},
    onProjectNameChange: () => {},
    onAddEnvVar: () => {},
    onUpdateEnvVar: () => {},
    onRemoveEnvVar: () => {},
    onMemoryChange: () => {},
    onDeploy: () => {},
    cancelHref: '#',
  },
} satisfies Meta<CreateProjectWizardProps>;

export default meta;
type Story = StoryObj<CreateProjectWizardProps>;

function InteractiveWizard(props: {initialStep?: 1 | 2 | 3 | 4}) {
  const [data, setData] = useState<WizardData>({
    ...INITIAL_WIZARD_DATA,
    step: props.initialStep || 1,
  });

  return (
    <CreateProjectWizard
      data={data}
      onStepChange={step => setData(prev => ({...prev, step}))}
      onFileSelect={f =>
        setData(prev => ({
          ...prev,
          file: {
            name: f.name,
            size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
          },
        }))
      }
      onFileRemove={() => setData(prev => ({...prev, file: null}))}
      onProjectNameChange={name =>
        setData(prev => ({
          ...prev,
          projectName: name,
          projectSlug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }))
      }
      onAddEnvVar={() =>
        setData(prev => ({
          ...prev,
          envVars: [
            ...prev.envVars,
            {id: Date.now().toString(), key: '', value: '', managed: false},
          ],
        }))
      }
      onUpdateEnvVar={(id, field, value) =>
        setData(prev => ({
          ...prev,
          envVars: prev.envVars.map(v =>
            v.id === id ? {...v, [field]: value} : v,
          ),
        }))
      }
      onRemoveEnvVar={id =>
        setData(prev => ({
          ...prev,
          envVars: prev.envVars.filter(v => v.id !== id),
        }))
      }
      onMemoryChange={memory => setData(prev => ({...prev, memory}))}
      onDeploy={() => setData(prev => ({...prev, step: 4}))}
      cancelHref="#"
    />
  );
}

export const Step1Upload: Story = {
  render: () => <InteractiveWizard initialStep={1} />,
};

export const Step2Configure: Story = {
  render: () => <InteractiveWizard initialStep={2} />,
};

export const Step3Review: Story = {
  render: () => <InteractiveWizard initialStep={3} />,
};

export const Step4Deploying: Story = {
  render: () => <InteractiveWizard initialStep={4} />,
};
