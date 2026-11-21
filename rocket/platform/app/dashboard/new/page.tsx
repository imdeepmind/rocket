'use client';

import React, {useState} from 'react';

import Box from '@/componentsV2/bits/Box';
import Flex from '@/componentsV2/bits/Flex';
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
  }

  function handleFileRemove() {
    setFile(null);
  }

  function handleAddEnvVar() {
    setEnvVars(prev => [
      ...prev,
      {id: Date.now().toString(), key: '', value: ''},
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
    <>
      <Breadcrumb
        items={[
          {label: 'Workspace', href: '/dashboard'},
          {label: 'Projects', href: '/dashboard'},
          {label: 'New Project', active: true},
        ]}
      />

      <Flex direction="column" gap="1" mt="4" mb="6">
        <Typography variant="h1">Create New Project</Typography>
        <Typography variant="body" color="muted">
          Upload and configure your microcontainer deployment in 4 simple steps.
        </Typography>
      </Flex>

      <Box mb="6">
        <CreateProjectStepper
          currentStep={step}
          onStepClick={newStep => setStep(newStep)}
        />
      </Box>

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
    </>
  );
}
