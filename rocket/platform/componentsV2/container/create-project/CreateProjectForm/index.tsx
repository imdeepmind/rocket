'use client';

import React from 'react';

import Avatar from '@/componentsV2/bits/Avatar';
import Box from '@/componentsV2/bits/Box';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Flex from '@/componentsV2/bits/Flex';
import IconBadge from '@/componentsV2/bits/IconBadge';
import IconButton from '@/componentsV2/bits/IconButton';
import ProgressBar from '@/componentsV2/bits/ProgressBar';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import IncludedFeaturesCard from '@/componentsV2/container/create-project/IncludedFeaturesCard';
import FileDropzone from '@/componentsV2/items/FileDropzone';
import OptionCardGroup from '@/componentsV2/items/OptionCardGroup';

import ArrowRightIcon from '@/icons/ArrowRightIcon';
import CheckIcon from '@/icons/CheckIcon';
import ChevronLeftIcon from '@/icons/ChevronLeftIcon';
import FileTextIcon from '@/icons/FileTextIcon';
import LockIcon from '@/icons/LockIcon';
import TrashIcon from '@/icons/TrashIcon';

import styles from './styles.module.css';

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
  {id: '256 MB', title: '256 MB', subtitle: 'Light APIs'},
  {id: '512 MB', title: '512 MB', subtitle: 'Recommended'},
  {id: '1 GB', title: '1 GB', subtitle: 'High traffic'},
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

  return (
    <Box maxW="1080" mx="auto" fullWidth classNameOverride={classNameOverride}>
      {data.step < 4 ? (
        <Box classNameOverride={styles.layoutGrid}>
          {/* Left Column: Form Step Card */}
          <Card
            variant="glass"
            radius="2xl"
            padding="none"
            classNameOverride={styles.mainCard}
          >
            {/* Step 1: Upload your configuration */}
            {data.step === 1 && (
              <>
                <Box mb="6">
                  <Typography variant="h2" weight="bold" color="white">
                    Upload your configuration
                  </Typography>
                  <Typography variant="body-sm" color="muted">
                    Upload a ZIP file containing your ROSS configuration and any
                    extra files such as functions or migrations.
                  </Typography>
                </Box>

                <FileDropzone
                  accept=".zip"
                  maxSizeText=".zip up to 50 MB"
                  file={data.file}
                  onFileSelect={onFileSelect}
                  onFileRemove={onFileRemove}
                  title="Drag and drop your ZIP here"
                  subtitle="or browse from your computer · .zip up to 50 MB"
                  buttonText="Choose ZIP file"
                />

                <Flex align="center" gap="2" mt="5">
                  <FileTextIcon width={15} height={15} stroke="currentColor" />
                  <Typography variant="caption" color="muted">
                    Place your configuration file at the root of the archive.{' '}
                    <Typography
                      as="a"
                      href="https://ross.imdeepmind.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      classNameOverride={styles.docsLink}
                    >
                      Read the docs ↗
                    </Typography>
                  </Typography>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  pt="6"
                  mt="8"
                  classNameOverride={styles.actionFooter}
                >
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
                    Next
                  </Button>
                </Flex>
              </>
            )}

            {/* Step 2: Configure your project */}
            {data.step === 2 && (
              <>
                <Box mb="6">
                  <Typography variant="h2" weight="bold" color="white">
                    Configure your project
                  </Typography>
                  <Typography variant="body-sm" color="muted">
                    Name your project, add environment variables and choose
                    memory.
                  </Typography>
                </Box>

                <Flex direction="column" gap="5">
                  {/* Project Name Field */}
                  <Flex direction="column" gap="2">
                    <Typography
                      variant="body-sm"
                      weight="medium"
                      color="default"
                    >
                      Project name
                    </Typography>
                    <TextBox
                      placeholder="e.g. blog-backend"
                      value={data.projectName}
                      onChange={e => onProjectNameChange(e.target.value)}
                      fullWidth
                      sizeVariant="md"
                    />
                    <Typography variant="mono" color="muted">
                      {data.projectSlug || 'my-project'}.rocket.app
                    </Typography>
                  </Flex>

                  {/* Environment Variables */}
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Typography
                        variant="body-sm"
                        weight="semibold"
                        color="white"
                      >
                        Environment variables
                      </Typography>
                      <Button variant="ghost" size="sm" onClick={onAddEnvVar}>
                        + Add variable
                      </Button>
                    </Flex>
                    <Box mb="2">
                      <Typography variant="caption" color="muted">
                        Database and cache URLs are injected for you.
                      </Typography>
                    </Box>

                    <Flex direction="column" gap="2">
                      {data.envVars.map(item => (
                        <Flex align="center" gap="2" key={item.id}>
                          <Box basis="40%">
                            <TextBox
                              sizeVariant="sm"
                              placeholder="KEY"
                              value={item.key}
                              disabled={item.managed}
                              onChange={e =>
                                onUpdateEnvVar(item.id, 'key', e.target.value)
                              }
                              fullWidth
                            />
                          </Box>
                          <Box flex="1">
                            {item.managed ? (
                              <Flex
                                align="center"
                                gap="2"
                                classNameOverride={styles.managedValueBox}
                              >
                                <LockIcon
                                  width={14}
                                  height={14}
                                  stroke="currentColor"
                                />
                                <Typography variant="body-sm" color="muted">
                                  Managed by Rocket
                                </Typography>
                              </Flex>
                            ) : (
                              <TextBox
                                sizeVariant="sm"
                                placeholder="Value"
                                value={item.value}
                                onChange={e =>
                                  onUpdateEnvVar(
                                    item.id,
                                    'value',
                                    e.target.value,
                                  )
                                }
                                fullWidth
                              />
                            )}
                          </Box>
                          <Box basis="36px" display="flex" justify="center">
                            {!item.managed && (
                              <IconButton
                                icon={<TrashIcon width={16} height={16} />}
                                aria-label={`Remove ${item.key}`}
                                size="sm"
                                variant="ghost"
                                onClick={() => onRemoveEnvVar(item.id)}
                              />
                            )}
                          </Box>
                        </Flex>
                      ))}
                    </Flex>
                  </Flex>

                  {/* Memory Selection */}
                  <Flex direction="column" gap="2">
                    <Typography
                      variant="body-sm"
                      weight="medium"
                      color="default"
                    >
                      Memory
                    </Typography>
                    <OptionCardGroup
                      options={MEMORY_OPTIONS}
                      value={data.memory}
                      onChange={onMemoryChange}
                      columns={3}
                    />
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  pt="6"
                  mt="8"
                  classNameOverride={styles.actionFooter}
                >
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
                    Next
                  </Button>
                </Flex>
              </>
            )}

            {/* Step 3: Review and deploy */}
            {data.step === 3 && (
              <>
                <Box mb="5">
                  <Typography variant="h2" weight="bold" color="white">
                    Review and deploy
                  </Typography>
                  <Typography variant="body-sm" color="muted">
                    Check your project details before deployment starts.
                  </Typography>
                </Box>

                {/* Project Identity Row */}
                <Flex
                  align="center"
                  gap="3"
                  pb="4"
                  mb="2"
                  classNameOverride={styles.reviewProjectIdentity}
                >
                  <Avatar
                    name={data.projectName}
                    size="md"
                    shape="rounded"
                    variant="project"
                  />
                  <Flex direction="column" gap="0">
                    <Typography variant="body" weight="bold" color="white">
                      {data.projectName}
                    </Typography>
                    <Typography variant="mono" color="muted">
                      {data.projectSlug || 'my-project'}.rocket.app
                    </Typography>
                  </Flex>
                </Flex>

                {/* Specs List */}
                <Flex
                  justify="between"
                  align="center"
                  py="4"
                  classNameOverride={styles.specRow}
                >
                  <Typography variant="body-sm" color="muted">
                    Configuration
                  </Typography>
                  <Flex align="center" gap="4">
                    <Typography variant="body-sm" weight="medium" color="white">
                      {data.file?.name} · {data.file?.size}
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepChange(1)}
                    >
                      Edit
                    </Button>
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  py="4"
                  classNameOverride={styles.specRow}
                >
                  <Typography variant="body-sm" color="muted">
                    Memory
                  </Typography>
                  <Flex align="center" gap="4">
                    <Typography variant="body-sm" weight="medium" color="white">
                      {data.memory}
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepChange(2)}
                    >
                      Edit
                    </Button>
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  py="4"
                  classNameOverride={styles.specRow}
                >
                  <Typography variant="body-sm" color="muted">
                    Environment variables
                  </Typography>
                  <Flex align="center" gap="4">
                    <Typography variant="body-sm" weight="medium" color="white">
                      {data.envVars.length} ({managedVarsCount} managed)
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepChange(2)}
                    >
                      Edit
                    </Button>
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  py="4"
                  classNameOverride={styles.specRow}
                >
                  <Typography variant="body-sm" color="muted">
                    Database
                  </Typography>
                  <Flex align="center" gap="4">
                    <Typography variant="body-sm" weight="medium" color="white">
                      PostgreSQL
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepChange(2)}
                    >
                      Edit
                    </Button>
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  py="4"
                  classNameOverride={styles.specRow}
                >
                  <Typography variant="body-sm" color="muted">
                    Cache
                  </Typography>
                  <Flex align="center" gap="4">
                    <Typography variant="body-sm" weight="medium" color="white">
                      Redis
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepChange(2)}
                    >
                      Edit
                    </Button>
                  </Flex>
                </Flex>

                <Flex
                  justify="between"
                  align="center"
                  pt="6"
                  mt="8"
                  classNameOverride={styles.actionFooter}
                >
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
                    rightIcon={<ArrowRightIcon width={16} height={16} />}
                  >
                    Deploy project
                  </Button>
                </Flex>
              </>
            )}
          </Card>

          {/* Right Column: Included with every project */}
          <IncludedFeaturesCard />
        </Box>
      ) : (
        /* Step 4: Deploying View */
        <Box classNameOverride={styles.deployingGrid}>
          {/* Left Column: Progress & Logs */}
          <Flex direction="column" gap="5">
            {/* Steps Progress Card */}
            <Card
              variant="glass"
              radius="2xl"
              padding="none"
              classNameOverride={styles.progressCard}
            >
              <Flex justify="between" align="center" mb="3">
                <Typography variant="body-sm" color="muted">
                  Step {data.deployStepIndex ?? 2} of 4
                </Typography>
                <Typography variant="body-sm" weight="semibold" color="white">
                  {data.deployProgress ?? 48}%
                </Typography>
              </Flex>

              <ProgressBar value={data.deployProgress ?? 48} />

              <Flex direction="column" gap="4" mt="5">
                {/* Step 1: Validating config */}
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3">
                    <IconBadge
                      variant="success"
                      size="sm"
                      rounded="full"
                      icon={
                        <CheckIcon
                          width={14}
                          height={14}
                          stroke="currentColor"
                          strokeWidth={2.5}
                        />
                      }
                    />
                    <Flex direction="column" gap="0">
                      <Typography
                        variant="body-sm"
                        weight="semibold"
                        color="white"
                      >
                        Validating configuration
                      </Typography>
                      <Typography variant="caption" color="muted">
                        ROSS configuration is valid
                      </Typography>
                    </Flex>
                  </Flex>
                  <Typography variant="caption" color="muted">
                    2s
                  </Typography>
                </Flex>

                {/* Step 2: Provisioning database */}
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3">
                    <Box classNameOverride={styles.deployStepIconActive} />
                    <Flex direction="column" gap="0">
                      <Typography
                        variant="body-sm"
                        weight="semibold"
                        color="white"
                      >
                        Provisioning database
                      </Typography>
                      <Typography variant="caption" color="muted">
                        Creating PostgreSQL and Redis
                      </Typography>
                    </Flex>
                  </Flex>
                  <Typography variant="caption" color="white" weight="medium">
                    In progress
                  </Typography>
                </Flex>

                {/* Step 3: Deploying code */}
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3">
                    <IconBadge variant="muted" size="sm" rounded="full" />
                    <Flex direction="column" gap="0">
                      <Typography variant="body-sm" color="muted">
                        Deploying code
                      </Typography>
                      <Typography variant="caption" color="muted">
                        Building and releasing your service
                      </Typography>
                    </Flex>
                  </Flex>
                  <Typography variant="caption" color="muted">
                    Waiting
                  </Typography>
                </Flex>

                {/* Step 4: Finalizing setup */}
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3">
                    <IconBadge variant="muted" size="sm" rounded="full" />
                    <Flex direction="column" gap="0">
                      <Typography variant="body-sm" color="muted">
                        Finalizing setup
                      </Typography>
                      <Typography variant="caption" color="muted">
                        Assigning your URL and running health checks
                      </Typography>
                    </Flex>
                  </Flex>
                  <Typography variant="caption" color="muted">
                    Waiting
                  </Typography>
                </Flex>
              </Flex>
            </Card>

            {/* Deployment Log Box */}
            <Card
              variant="glass"
              radius="2xl"
              padding="none"
              classNameOverride={styles.logCard}
            >
              <Box mb="3">
                <Typography variant="body-sm" weight="semibold" color="white">
                  Deployment log
                </Typography>
              </Box>
              <Box classNameOverride={styles.logConsole}>
                <Typography
                  variant="caption"
                  classNameOverride={styles.logLine}
                >
                  10:42:01 Validating configuration...
                </Typography>
                <Typography
                  variant="caption"
                  classNameOverride={styles.logLine}
                >
                  10:42:03 Configuration is valid
                </Typography>
                <Typography
                  variant="caption"
                  classNameOverride={styles.logLine}
                >
                  10:42:04 Provisioning PostgreSQL...
                </Typography>
                <Typography
                  variant="caption"
                  classNameOverride={styles.logLine}
                >
                  10:42:06 Provisioning Redis...
                </Typography>
                <Typography
                  variant="caption"
                  classNameOverride={styles.logLine}
                >
                  10:42:08 Waiting for database to accept connections
                  <Box as="span" classNameOverride={styles.logCursor}>
                    |
                  </Box>
                </Typography>
              </Box>
            </Card>
          </Flex>

          {/* Right Column: Project Info Summary */}
          <Card
            variant="glass"
            radius="2xl"
            padding="none"
            classNameOverride={styles.sideCard}
          >
            <Flex
              align="center"
              gap="3"
              pb="4"
              mb="2"
              classNameOverride={styles.reviewProjectIdentity}
            >
              <Avatar
                name={data.projectName}
                size="md"
                shape="rounded"
                variant="project"
              />
              <Flex direction="column" gap="0">
                <Typography variant="body" weight="bold" color="white">
                  {data.projectName}
                </Typography>
                <Typography variant="mono" color="muted">
                  {data.projectSlug || 'my-project'}
                </Typography>
              </Flex>
            </Flex>

            <Flex
              justify="between"
              align="center"
              py="3"
              classNameOverride={styles.specRow}
            >
              <Typography variant="body-sm" color="muted">
                Configuration
              </Typography>
              <Typography variant="body-sm" weight="medium" color="white">
                {data.file?.name}
              </Typography>
            </Flex>

            <Flex
              justify="between"
              align="center"
              py="3"
              classNameOverride={styles.specRow}
            >
              <Typography variant="body-sm" color="muted">
                Memory
              </Typography>
              <Typography variant="body-sm" weight="medium" color="white">
                {data.memory}
              </Typography>
            </Flex>

            <Flex
              justify="between"
              align="center"
              py="3"
              classNameOverride={styles.specRow}
            >
              <Typography variant="body-sm" color="muted">
                Database
              </Typography>
              <Typography variant="body-sm" weight="medium" color="white">
                PostgreSQL
              </Typography>
            </Flex>

            <Flex
              justify="between"
              align="center"
              py="3"
              classNameOverride={styles.specRow}
            >
              <Typography variant="body-sm" color="muted">
                Cache
              </Typography>
              <Typography variant="body-sm" weight="medium" color="white">
                Redis
              </Typography>
            </Flex>

            <Flex
              justify="between"
              align="center"
              py="3"
              classNameOverride={styles.specRow}
            >
              <Typography variant="body-sm" color="muted">
                URL
              </Typography>
              <Typography variant="body-sm" color="muted">
                Assigned on completion
              </Typography>
            </Flex>

            <Box mt="6">
              <Button variant="secondary" size="md" href="/dashboard" fullWidth>
                Back to projects
              </Button>
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
}
