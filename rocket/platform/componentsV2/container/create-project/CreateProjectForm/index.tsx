'use client';

import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';
import ChevronLeftIcon from '@/icons/ChevronLeftIcon';
import DatabaseIcon from '@/icons/DatabaseIcon';
import LayersIcon from '@/icons/LayersIcon';
import RocketIcon from '@/icons/RocketIcon';
import TrashIcon from '@/icons/TrashIcon';
import ZapIcon from '@/icons/ZapIcon';

import Avatar from '@/componentsV2/bits/Avatar';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import Grid from '@/componentsV2/bits/Grid';
import IconBadge from '@/componentsV2/bits/IconBadge';
import IconButton from '@/componentsV2/bits/IconButton';
import ProgressBar from '@/componentsV2/bits/ProgressBar';
import StatusDot from '@/componentsV2/bits/StatusDot';
import Tag from '@/componentsV2/bits/Tag';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import FileDropzone from '@/componentsV2/items/FileDropzone';
import OptionCardGroup from '@/componentsV2/items/OptionCardGroup';
import TerminalViewer from '@/componentsV2/items/TerminalViewer';

export interface EnvVarItem {
  id: string;
  key: string;
  value: string;
  managed?: boolean;
}

export interface ProjectFormData {
  step: 1 | 2 | 3 | 4;
  file: {name: string; size: string} | null;
  projectName: string;
  projectSlug: string;
  envVars: EnvVarItem[];
  memory: string;
  deployStepIndex?: number;
  deployProgress?: number;
  logLines?: string[];
}

export interface CreateProjectFormProps {
  data: ProjectFormData;
  onStepChange: (step: 1 | 2 | 3 | 4) => void;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onProjectNameChange: (name: string) => void;
  onAddEnvVar: () => void;
  onUpdateEnvVar: (id: string, field: 'key' | 'value', value: string) => void;
  onRemoveEnvVar: (id: string) => void;
  onMemoryChange: (memory: string) => void;
  onDeploy: () => void;
  cancelHref?: string;
  classNameOverride?: string;
}

const MEMORY_OPTIONS = [
  {id: '256 MB', title: '256 MB', subtitle: 'Basic staging & test APIs'},
  {
    id: '512 MB',
    title: '512 MB',
    subtitle: 'Recommended for standard REST APIs',
  },
  {id: '1 GB', title: '1 GB', subtitle: 'High-throughput workloads'},
];

const DEPLOY_STEPS = [
  'Validating archive structure',
  'Parsing ROSS config.json',
  'Provisioning isolated container',
  'Injecting environment variables',
  'Starting HTTP server & running healthcheck',
];

export default function CreateProjectForm({
  data,
  onStepChange,
  onFileSelect,
  onFileRemove,
  onProjectNameChange,
  onAddEnvVar,
  onUpdateEnvVar,
  onRemoveEnvVar,
  onMemoryChange,
  onDeploy,
  cancelHref = '/dashboard',
  classNameOverride,
}: CreateProjectFormProps): React.JSX.Element {
  const managedVarsCount = data.envVars.filter(v => v.managed).length;
  const customVarsCount = data.envVars.filter(v => !v.managed).length;

  return (
    <Box maxW="840" mx="auto" fullWidth classNameOverride={classNameOverride}>
      {/* Step 1: Upload Archive */}
      {data.step === 1 && (
        <Card padding="lg">
          <Box mb="6">
            <Typography variant="h3">Upload your ROSS project</Typography>
            <Typography variant="body-sm" color="muted">
              Select or drop your project repository packaged as a .zip file.
            </Typography>
          </Box>

          <FileDropzone
            accept=".zip"
            maxSizeText=".zip archive up to 50 MB"
            file={data.file}
            onFileSelect={onFileSelect}
            onFileRemove={onFileRemove}
            title="Drop your ROSS archive here"
            subtitle="Must include ross/config.json or root config.json"
          />

          <Flex justify="between" align="center" pt="4" mt="6" borderTop>
            <Button variant="ghost" size="md" href={cancelHref}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!data.file}
              onClick={() => onStepChange(2)}
              rightIcon={<ArrowRightIcon width={16} height={16} />}
            >
              Continue to configuration
            </Button>
          </Flex>
        </Card>
      )}

      {/* Step 2: Configure & Environment */}
      {data.step === 2 && (
        <Card padding="lg">
          <Box mb="6">
            <Typography variant="h3">Configure your project</Typography>
            <Typography variant="body-sm" color="muted">
              Configure name, memory limits, and environment variables.
            </Typography>
          </Box>

          <Box mb="6">
            <TextBox
              label="Project Name"
              placeholder="e.g. Blog Backend"
              value={data.projectName}
              onChange={e => onProjectNameChange(e.target.value)}
              fullWidth
              hint={`Assigned subdomain: ${data.projectSlug || 'my-project'}.rocket.app`}
            />
          </Box>

          {/* Memory Selection */}
          <Flex direction="column" gap="3" mb="6">
            <Typography variant="body-sm" weight="semibold">
              Compute & Memory Allocation
            </Typography>
            <OptionCardGroup
              options={MEMORY_OPTIONS}
              value={data.memory}
              onChange={onMemoryChange}
              columns={3}
            />
          </Flex>

          {/* Environment Variables */}
          <Flex direction="column" gap="3" mb="6">
            <Flex justify="between" align="center" mb="2">
              <Box>
                <Typography variant="body-sm" weight="semibold">
                  Environment Variables ({data.envVars.length})
                </Typography>
                <Typography variant="caption" color="muted">
                  Managed variables are automatically provided by Rocket
                  platform.
                </Typography>
              </Box>
              <Button variant="secondary" size="sm" onClick={onAddEnvVar}>
                + Add Variable
              </Button>
            </Flex>

            <Flex direction="column" gap="2">
              {data.envVars.map(item => (
                <Flex align="center" gap="2" key={item.id}>
                  <Box flex="1">
                    <TextBox
                      sizeVariant="sm"
                      placeholder="KEY_NAME"
                      value={item.key}
                      disabled={item.managed}
                      onChange={e =>
                        onUpdateEnvVar(item.id, 'key', e.target.value)
                      }
                      fullWidth
                    />
                  </Box>
                  <Box flex="1">
                    <TextBox
                      sizeVariant="sm"
                      placeholder="value"
                      value={item.value}
                      disabled={item.managed}
                      onChange={e =>
                        onUpdateEnvVar(item.id, 'value', e.target.value)
                      }
                      fullWidth
                    />
                  </Box>
                  <Flex basis="72px" justify="center">
                    {item.managed ? (
                      <Tag variant="neutral" size="sm">
                        Managed
                      </Tag>
                    ) : (
                      <IconButton
                        icon={<TrashIcon width={14} height={14} />}
                        aria-label="Remove variable"
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveEnvVar(item.id)}
                      />
                    )}
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Flex>

          <Flex justify="between" align="center" pt="4" borderTop>
            <Button
              variant="ghost"
              size="md"
              onClick={() => onStepChange(1)}
              leftIcon={<ChevronLeftIcon width={16} height={16} />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!data.projectName.trim()}
              onClick={() => onStepChange(3)}
              rightIcon={<ArrowRightIcon width={16} height={16} />}
            >
              Review specifications
            </Button>
          </Flex>
        </Card>
      )}

      {/* Step 3: Review Specifications */}
      {data.step === 3 && (
        <Card padding="lg">
          <Box mb="6">
            <Typography variant="h3">Review & deploy</Typography>
            <Typography variant="body-sm" color="muted">
              Confirm your deployment parameters before launching to production.
            </Typography>
          </Box>

          <Box mb="6">
            <Grid columns={2} gap="4">
              <Card variant="subtle" padding="md">
                <Flex align="start" gap="3">
                  <IconBadge
                    variant="primary"
                    size="md"
                    icon={
                      <LayersIcon
                        width={18}
                        height={18}
                        stroke="currentColor"
                      />
                    }
                  />
                  <Flex direction="column" gap="1">
                    <Typography variant="caption" color="muted">
                      Package Archive
                    </Typography>
                    <Typography variant="body" weight="semibold">
                      {data.file?.name || 'No file selected'}
                    </Typography>
                    <Typography variant="body-sm" color="muted">
                      Size: {data.file?.size || '0 MB'}
                    </Typography>
                  </Flex>
                </Flex>
              </Card>

              <Card variant="subtle" padding="md">
                <Flex align="start" gap="3">
                  <IconBadge
                    variant="primary"
                    size="md"
                    icon={
                      <RocketIcon
                        width={18}
                        height={18}
                        stroke="currentColor"
                      />
                    }
                  />
                  <Flex direction="column" gap="1">
                    <Typography variant="caption" color="muted">
                      Service Name & Endpoint
                    </Typography>
                    <Typography variant="body" weight="semibold">
                      {data.projectName}
                    </Typography>
                    <Typography variant="body-sm" color="muted">
                      https://{data.projectSlug}.rocket.app
                    </Typography>
                  </Flex>
                </Flex>
              </Card>

              <Card variant="subtle" padding="md">
                <Flex align="start" gap="3">
                  <IconBadge
                    variant="primary"
                    size="md"
                    icon={
                      <ZapIcon width={18} height={18} stroke="currentColor" />
                    }
                  />
                  <Flex direction="column" gap="1">
                    <Typography variant="caption" color="muted">
                      Compute Memory
                    </Typography>
                    <Typography variant="body" weight="semibold">
                      {data.memory}
                    </Typography>
                    <Typography variant="body-sm" color="muted">
                      Isolated Microcontainer
                    </Typography>
                  </Flex>
                </Flex>
              </Card>

              <Card variant="subtle" padding="md">
                <Flex align="start" gap="3">
                  <IconBadge
                    variant="primary"
                    size="md"
                    icon={
                      <DatabaseIcon
                        width={18}
                        height={18}
                        stroke="currentColor"
                      />
                    }
                  />
                  <Flex direction="column" gap="1">
                    <Typography variant="caption" color="muted">
                      Environment Configuration
                    </Typography>
                    <Typography variant="body" weight="semibold">
                      {data.envVars.length} Variables Configured
                    </Typography>
                    <Typography variant="body-sm" color="muted">
                      {managedVarsCount} managed, {customVarsCount} custom
                    </Typography>
                  </Flex>
                </Flex>
              </Card>
            </Grid>
          </Box>

          <Flex justify="between" align="center" pt="4" borderTop>
            <Button
              variant="ghost"
              size="md"
              onClick={() => onStepChange(2)}
              leftIcon={<ChevronLeftIcon width={16} height={16} />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onDeploy}
              rightIcon={<RocketIcon width={16} height={16} />}
            >
              Deploy Backend
            </Button>
          </Flex>
        </Card>
      )}

      {/* Step 4: Live Deployment Execution */}
      {data.step === 4 && (
        <Card padding="lg">
          <Box mb="6">
            <Flex align="center" gap="3">
              <Avatar name={data.projectName} size="md" variant="project" />
              <Flex direction="column">
                <Typography variant="h3">
                  Deploying {data.projectName}
                </Typography>
                <Typography variant="body-sm" color="muted">
                  Provisioning runtime container and starting ROSS backend...
                </Typography>
              </Flex>
            </Flex>
          </Box>

          {/* Progress Bar */}
          <Box mb="6">
            <Flex justify="between" align="center" mb="2">
              <Typography variant="caption" color="muted">
                Overall deployment progress
              </Typography>
              <Typography variant="caption" weight="semibold">
                {data.deployProgress ?? 48}%
              </Typography>
            </Flex>
            <ProgressBar value={data.deployProgress ?? 48} />
          </Box>

          {/* Checklist */}
          <Card variant="subtle" padding="md">
            <Flex direction="column" gap="3">
              {DEPLOY_STEPS.map((stepLabel, idx) => {
                const currentIdx = data.deployStepIndex ?? 2;
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <Flex align="center" gap="3" key={idx}>
                    <StatusDot
                      variant={
                        isCompleted
                          ? 'success'
                          : isCurrent
                            ? 'warning'
                            : 'waiting'
                      }
                      pulse={isCurrent}
                    />
                    <Typography
                      variant="body-sm"
                      color={isCompleted || isCurrent ? 'default' : 'muted'}
                      weight={isCurrent ? 'semibold' : 'normal'}
                    >
                      {stepLabel}
                    </Typography>
                  </Flex>
                );
              })}
            </Flex>
          </Card>

          {/* Terminal Viewer */}
          <Box my="6">
            <TerminalViewer
              title="build & deploy logs"
              lines={
                data.logLines || [
                  '$ rocket deploy --source /uploads/blog-backend.zip',
                  '✓ Unpacking project archive: blog-backend.zip (2.4 MB)',
                  '✓ Parsing ROSS config.json: 4 endpoints detected',
                  'ℹ Provisioning 512 MB microcontainer (us-east-1)...',
                  'ℹ Injecting 3 environment variables...',
                  '⠋ Starting server process on port 8080...',
                ]
              }
              maxHeight="220px"
            />
          </Box>

          <Flex justify="between" align="center" pt="4" borderTop>
            <Button variant="ghost" size="md" href="/dashboard">
              View in dashboard
            </Button>
          </Flex>
        </Card>
      )}
    </Box>
  );
}
