'use client';

import Link from 'next/link';
import React from 'react';

import ArrowRightIcon from '@/icons/ArrowRightIcon';
import CheckIcon from '@/icons/CheckIcon';
import ChevronLeftIcon from '@/icons/ChevronLeftIcon';
import DatabaseIcon from '@/icons/DatabaseIcon';
import LayersIcon from '@/icons/LayersIcon';
import RocketIcon from '@/icons/RocketIcon';
import TrashIcon from '@/icons/TrashIcon';
import ZapIcon from '@/icons/ZapIcon';

import Avatar from '@/componentsV2/bits/Avatar';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import IconButton from '@/componentsV2/bits/IconButton';
import ProgressBar from '@/componentsV2/bits/ProgressBar';
import Tag from '@/componentsV2/bits/Tag';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';
import FileDropzone from '@/componentsV2/items/FileDropzone';
import OptionCardGroup from '@/componentsV2/items/OptionCardGroup';
import Stepper from '@/componentsV2/items/Stepper';
import TerminalViewer from '@/componentsV2/items/TerminalViewer';

import styles from './styles.module.css';

export interface EnvVarItem {
  id: string;
  key: string;
  value: string;
  managed?: boolean;
}

export interface WizardData {
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

export interface CreateProjectWizardProps {
  data: WizardData;
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

const WIZARD_STEPS = [
  {title: 'Upload', subtitle: 'Project ZIP'},
  {title: 'Configure', subtitle: 'Settings & env'},
  {title: 'Review', subtitle: 'Specifications'},
  {title: 'Deploy', subtitle: 'Live execution'},
];

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

export default function CreateProjectWizard({
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
}: CreateProjectWizardProps): React.JSX.Element {
  const containerClass = [styles.container, classNameOverride]
    .filter(Boolean)
    .join(' ');

  const managedVarsCount = data.envVars.filter(v => v.managed).length;
  const customVarsCount = data.envVars.filter(v => !v.managed).length;

  return (
    <div className={containerClass}>
      {/* Stepper Navigation */}
      <Stepper
        steps={WIZARD_STEPS}
        currentStep={data.step}
        onStepClick={stepIdx => {
          if (stepIdx >= 1 && stepIdx <= 4) {
            onStepChange(stepIdx as 1 | 2 | 3 | 4);
          }
        }}
      />

      {/* Step 1: Upload Archive */}
      {data.step === 1 && (
        <Card padding="lg" classNameOverride={styles.stepCard}>
          <div className={styles.headerBlock}>
            <Typography variant="h3">Upload your ROSS project</Typography>
            <Typography variant="body-sm" color="muted">
              Select or drop your project repository packaged as a .zip file.
            </Typography>
          </div>

          <FileDropzone
            accept=".zip"
            maxSizeText=".zip archive up to 50 MB"
            file={data.file}
            onFileSelect={onFileSelect}
            onFileRemove={onFileRemove}
            title="Drop your ROSS archive here"
            subtitle="Must include ross/config.json or root config.json"
          />

          <div className={styles.actionsBar}>
            <Link href={cancelHref} className={styles.cancelLink}>
              <Button variant="ghost" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              disabled={!data.file}
              onClick={() => onStepChange(2)}
              rightIcon={<ArrowRightIcon width={16} height={16} />}
            >
              Continue to configuration
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Configure & Environment */}
      {data.step === 2 && (
        <Card padding="lg" classNameOverride={styles.stepCard}>
          <div className={styles.headerBlock}>
            <Typography variant="h3">Configure your project</Typography>
            <Typography variant="body-sm" color="muted">
              Configure name, memory limits, and environment variables.
            </Typography>
          </div>

          <div className={styles.formGroup}>
            <TextBox
              label="Project Name"
              placeholder="e.g. Blog Backend"
              value={data.projectName}
              onChange={e => onProjectNameChange(e.target.value)}
              fullWidth
              hint={`Assigned subdomain: ${data.projectSlug || 'my-project'}.rocket.app`}
            />
          </div>

          {/* Memory Selection */}
          <div className={styles.formGroup}>
            <Typography variant="body-sm" weight="semibold">
              Compute & Memory Allocation
            </Typography>
            <OptionCardGroup
              options={MEMORY_OPTIONS}
              value={data.memory}
              onChange={onMemoryChange}
              columns={3}
            />
          </div>

          {/* Environment Variables */}
          <div className={styles.formGroup}>
            <div className={styles.envHeader}>
              <div>
                <Typography variant="body-sm" weight="semibold">
                  Environment Variables ({data.envVars.length})
                </Typography>
                <Typography variant="caption" color="muted">
                  Managed variables are automatically provided by Rocket
                  platform.
                </Typography>
              </div>
              <Button variant="secondary" size="sm" onClick={onAddEnvVar}>
                + Add Variable
              </Button>
            </div>

            <div className={styles.envList}>
              {data.envVars.map(item => (
                <div key={item.id} className={styles.envRow}>
                  <div className={styles.envInputCol}>
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
                  </div>
                  <div className={styles.envInputCol}>
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
                  </div>
                  <div className={styles.envActionCol}>
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.actionsBar}>
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
          </div>
        </Card>
      )}

      {/* Step 3: Review Specifications */}
      {data.step === 3 && (
        <Card padding="lg" classNameOverride={styles.stepCard}>
          <div className={styles.headerBlock}>
            <Typography variant="h3">Review & deploy</Typography>
            <Typography variant="body-sm" color="muted">
              Confirm your deployment parameters before launching to production.
            </Typography>
          </div>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewSection}>
              <div className={styles.reviewIconBadge}>
                <LayersIcon width={18} height={18} stroke="currentColor" />
              </div>
              <div className={styles.reviewContent}>
                <Typography variant="caption" color="muted">
                  Package Archive
                </Typography>
                <Typography variant="body" weight="semibold">
                  {data.file?.name || 'No file selected'}
                </Typography>
                <Typography variant="body-sm" color="muted">
                  Size: {data.file?.size || '0 MB'}
                </Typography>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <div className={styles.reviewIconBadge}>
                <RocketIcon width={18} height={18} stroke="currentColor" />
              </div>
              <div className={styles.reviewContent}>
                <Typography variant="caption" color="muted">
                  Service Name & Endpoint
                </Typography>
                <Typography variant="body" weight="semibold">
                  {data.projectName}
                </Typography>
                <Typography variant="body-sm" color="muted">
                  https://{data.projectSlug}.rocket.app
                </Typography>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <div className={styles.reviewIconBadge}>
                <ZapIcon width={18} height={18} stroke="currentColor" />
              </div>
              <div className={styles.reviewContent}>
                <Typography variant="caption" color="muted">
                  Compute Memory
                </Typography>
                <Typography variant="body" weight="semibold">
                  {data.memory}
                </Typography>
                <Typography variant="body-sm" color="muted">
                  Isolated Microcontainer
                </Typography>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <div className={styles.reviewIconBadge}>
                <DatabaseIcon width={18} height={18} stroke="currentColor" />
              </div>
              <div className={styles.reviewContent}>
                <Typography variant="caption" color="muted">
                  Environment Configuration
                </Typography>
                <Typography variant="body" weight="semibold">
                  {data.envVars.length} Variables Configured
                </Typography>
                <Typography variant="body-sm" color="muted">
                  {managedVarsCount} managed, {customVarsCount} custom
                </Typography>
              </div>
            </div>
          </div>

          <div className={styles.actionsBar}>
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
          </div>
        </Card>
      )}

      {/* Step 4: Live Deployment Execution */}
      {data.step === 4 && (
        <Card padding="lg" classNameOverride={styles.stepCard}>
          <div className={styles.headerBlock}>
            <div className={styles.deployTitleRow}>
              <Avatar name={data.projectName} size="md" variant="project" />
              <div>
                <Typography variant="h3">
                  Deploying {data.projectName}
                </Typography>
                <Typography variant="body-sm" color="muted">
                  Provisioning runtime container and starting ROSS backend...
                </Typography>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <Typography variant="caption" color="muted">
                Overall deployment progress
              </Typography>
              <Typography variant="caption" weight="semibold">
                {data.deployProgress ?? 48}%
              </Typography>
            </div>
            <ProgressBar value={data.deployProgress ?? 48} />
          </div>

          {/* Checklist */}
          <div className={styles.checklist}>
            {DEPLOY_STEPS.map((stepLabel, idx) => {
              const currentIdx = data.deployStepIndex ?? 2;
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={idx} className={styles.checkItem}>
                  <div
                    className={[
                      styles.checkCircle,
                      isCompleted ? styles.checkDone : '',
                      isCurrent ? styles.checkCurrent : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isCompleted ? (
                      <CheckIcon width={12} height={12} stroke="currentColor" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <Typography
                    variant="body-sm"
                    color={isCompleted || isCurrent ? 'primary' : 'muted'}
                    weight={isCurrent ? 'semibold' : 'normal'}
                  >
                    {stepLabel}
                  </Typography>
                </div>
              );
            })}
          </div>

          {/* Terminal Viewer */}
          <div className={styles.terminalContainer}>
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
          </div>

          <div className={styles.actionsBar}>
            <Link href="/dashboard" className={styles.cancelLink}>
              <Button variant="ghost" size="md">
                View in dashboard
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
