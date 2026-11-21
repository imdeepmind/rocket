'use client';

import React, {useState} from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
import Tag from '@/componentsV2/bits/Tag';
import Typography from '@/componentsV2/bits/Typography';
import CreateProjectForm, {
  type EnvVarItem,
} from '@/componentsV2/container/create-project/CreateProjectForm';
import CreateProjectStepper from '@/componentsV2/container/create-project/CreateProjectStepper';
import Breadcrumb from '@/componentsV2/items/Breadcrumb';

export default function NewProjectPage(): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<{name: string; size: string} | null>({
    name: 'blog-backend.zip',
    size: '2.4 MB',
  });
  const [projectName, setProjectName] = useState('Blog Backend');
  const [envVars, setEnvVars] = useState<EnvVarItem[]>([
    {id: '1', key: 'DATABASE_URL', value: 'Managed by Rocket', managed: true},
    {id: '2', key: 'REDIS_URL', value: 'Managed by Rocket', managed: true},
    {id: '3', key: 'API_SECRET', value: '••••••••••••', managed: false},
  ]);
  const [memory, setMemory] = useState('512 MB');

  const projectSlug =
    projectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'my-project';

  function handleFileSelect(selectedFile: File) {
    setFile({
      name: selectedFile.name,
      size: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
    });
    if (projectName === 'Blog Backend' || !projectName.trim()) {
      const inferred = selectedFile.name
        .replace(/\.zip$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      setProjectName(inferred);
    }
  }

  function handleFileRemove() {
    setFile(null);
  }

  function handleAddEnvVar() {
    setEnvVars(prev => [
      ...prev,
      {id: Date.now().toString(), key: '', value: '', managed: false},
    ]);
  }

  function handleUpdateEnvVar(
    id: string,
    field: 'key' | 'value',
    value: string,
  ) {
    setEnvVars(prev =>
      prev.map(v => (v.id === id ? {...v, [field]: value} : v)),
    );
  }

  function handleRemoveEnvVar(id: string) {
    setEnvVars(prev => prev.filter(v => v.id !== id));
  }

  function handleDeploy() {
    setStep(4);
  }

  return (
    <Box maxW="1080" mx="auto" fullWidth>
      <Breadcrumb
        items={[
          {label: 'Projects', href: '/dashboard'},
          {
            label: step === 4 ? projectName : 'New project',
            active: true,
          },
        ]}
      />

      <Flex
        direction="row"
        justify="between"
        align="start"
        wrap="wrap"
        gap="5"
        mt="3"
        mb="6"
      >
        <Flex direction="column" gap="1">
          <Typography variant="h1">
            {step === 4 ? `Deploying ${projectName}` : 'Create new project'}
          </Typography>
          <Typography variant="body" color="muted">
            {step === 4
              ? "This may take a few moments. We'll notify you once it's ready."
              : 'Deploy a new backend from your ROSS configuration.'}
          </Typography>
        </Flex>

        {step === 4 && (
          <Tag variant="warning" size="md">
            In progress
          </Tag>
        )}
      </Flex>

      {step < 4 && (
        <Box mb="6">
          <CreateProjectStepper
            currentStep={step as 1 | 2 | 3}
            onStepClick={newStep => setStep(newStep)}
          />
        </Box>
      )}

      <CreateProjectForm
        data={{
          step,
          file,
          projectName,
          projectSlug,
          envVars,
          memory,
          deployStepIndex: 2,
          deployProgress: 48,
        }}
        onStepChange={newStep => setStep(newStep)}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        onProjectNameChange={setProjectName}
        onAddEnvVar={handleAddEnvVar}
        onUpdateEnvVar={handleUpdateEnvVar}
        onRemoveEnvVar={handleRemoveEnvVar}
        onMemoryChange={setMemory}
        onDeploy={handleDeploy}
        cancelHref="/dashboard"
      />
    </Box>
  );
}
