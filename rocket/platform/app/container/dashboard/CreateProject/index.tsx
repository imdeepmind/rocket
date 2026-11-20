'use client';

import Link from 'next/link';
import React, {useRef, useState} from 'react';

import Badge from '@/app/components/bits/Badge';
import Card from '@/app/components/bits/Card';

import {
  ActivityIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  DatabaseIcon,
  FileTextIcon,
  LayersIcon,
  LockIcon,
  TrashIcon,
  UploadCloudIcon,
  ZapIcon,
} from '@/app/icons';

import styles from './styles.module.css';

interface EnvVar {
  id: string;
  key: string;
  value: string;
  managed?: boolean;
}

interface UploadedFile {
  name: string;
  size: string;
}

export function CreateProject(): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<UploadedFile>({
    name: 'blog-backend.zip',
    size: '2.4 MB',
  });
  const [projectName, setProjectName] = useState('Blog Backend');
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    {id: '1', key: 'DATABASE_URL', value: 'Managed by Rocket', managed: true},
    {id: '2', key: 'REDIS_URL', value: 'Managed by Rocket', managed: true},
    {id: '3', key: 'API_SECRET', value: '••••••••••••', managed: false},
  ]);
  const [memory, setMemory] = useState<'256 MB' | '512 MB' | '1 GB'>('512 MB');
  const [isDragging, setIsDragging] = useState(false);

  // Deploying simulation state (exact state in design Image 4)
  const deployStepIndex = 2;
  const deployProgress = 48;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive slug from project name
  const projectSlug =
    projectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'my-project';

  const avatarInitial = projectName.trim()
    ? projectName.trim()[0].toUpperCase()
    : 'P';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      const sizeMB = (selected.size / (1024 * 1024)).toFixed(1);
      setFile({
        name: selected.name,
        size: `${sizeMB} MB`,
      });
      if (projectName === 'Blog Backend' || !projectName.trim()) {
        const inferred = selected.name
          .replace(/\.zip$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        setProjectName(inferred);
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const sizeMB = (dropped.size / (1024 * 1024)).toFixed(1);
      setFile({
        name: dropped.name,
        size: `${sizeMB} MB`,
      });
      if (projectName === 'Blog Backend' || !projectName.trim()) {
        const inferred = dropped.name
          .replace(/\.zip$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        setProjectName(inferred);
      }
    }
  }

  function addEnvVar() {
    const newId = Date.now().toString();
    setEnvVars(prev => [
      ...prev,
      {id: newId, key: '', value: '', managed: false},
    ]);
  }

  function removeEnvVar(id: string) {
    setEnvVars(prev => prev.filter(v => v.id !== id));
  }

  function updateEnvVar(id: string, field: 'key' | 'value', val: string) {
    setEnvVars(prev => prev.map(v => (v.id === id ? {...v, [field]: val} : v)));
  }

  const managedCount = envVars.filter(v => v.managed).length;
  const totalEnvCount = envVars.length;

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/dashboard" className={styles.breadcrumbLink}>
          Projects
        </Link>
        <span>/</span>
        <span className={styles.breadcrumbActive}>
          {step === 4 ? projectName : 'New project'}
        </span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            {step === 4 ? `Deploying ${projectName}` : 'Create new project'}
          </h1>
          <p className={styles.subtitle}>
            {step === 4
              ? "This may take a few moments. We'll notify you once it's ready."
              : 'Deploy a new backend from your ROSS configuration.'}
          </p>
        </div>

        {step === 4 && <Badge variant="deploying">In progress</Badge>}
      </div>

      {/* Stepper (Only shown during wizard steps 1-3) */}
      {step < 4 && (
        <Card padding="none" className={styles.stepper}>
          {/* Step 1 */}
          <div className={styles.stepItem}>
            <div
              className={[
                styles.stepBadge,
                step === 1 ? styles.stepBadgeActive : '',
                step > 1 ? styles.stepBadgeCompleted : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step > 1 ? (
                <CheckIcon
                  width={15}
                  height={15}
                  stroke="currentColor"
                  strokeWidth={2.5}
                />
              ) : (
                '1'
              )}
            </div>
            <div className={styles.stepText}>
              <span className={styles.stepTitle}>Upload config</span>
              <span className={styles.stepSubtitle}>Add your ZIP</span>
            </div>
          </div>

          <div className={styles.stepLine} />

          {/* Step 2 */}
          <div className={styles.stepItem}>
            <div
              className={[
                styles.stepBadge,
                step === 2 ? styles.stepBadgeActive : '',
                step > 2 ? styles.stepBadgeCompleted : '',
                step < 2 ? styles.stepBadgeInactive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step > 2 ? (
                <CheckIcon
                  width={15}
                  height={15}
                  stroke="currentColor"
                  strokeWidth={2.5}
                />
              ) : (
                '2'
              )}
            </div>
            <div className={styles.stepText}>
              <span
                className={[
                  styles.stepTitle,
                  step < 2 ? styles.stepTitleInactive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                Configure
              </span>
              <span className={styles.stepSubtitle}>Set up your app</span>
            </div>
          </div>

          <div className={styles.stepLine} />

          {/* Step 3 */}
          <div className={styles.stepItem}>
            <div
              className={[
                styles.stepBadge,
                step === 3 ? styles.stepBadgeActive : '',
                step < 3 ? styles.stepBadgeInactive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              3
            </div>
            <div className={styles.stepText}>
              <span
                className={[
                  styles.stepTitle,
                  step < 3 ? styles.stepTitleInactive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                Review & deploy
              </span>
              <span className={styles.stepSubtitle}>Confirm and launch</span>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Area */}
      {step < 4 ? (
        <div className={styles.layoutGrid}>
          {/* Left Column: Step Cards */}
          <Card padding="none" className={styles.mainCard}>
            {step === 1 && (
              <>
                <h2 className={styles.cardTitle}>Upload your configuration</h2>
                <p className={styles.cardSubtitle}>
                  Upload a ZIP file containing your ROSS configuration and any
                  extra files such as functions or migrations.
                </p>

                <div
                  className={[
                    styles.dropzone,
                    isDragging ? styles.dropzoneActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    style={{display: 'none'}}
                  />

                  <div className={styles.dropzoneIconWrapper}>
                    <UploadCloudIcon width={24} height={24} />
                  </div>

                  <p className={styles.dropzoneText}>
                    Drag and drop your ZIP file here
                  </p>
                  <p className={styles.dropzoneSubtext}>
                    or browse from your computer · .zip up to 50 MB
                  </p>

                  <button
                    type="button"
                    className={styles.chooseFileBtn}
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Choose ZIP file
                  </button>

                  {file && (
                    <div className={styles.fileSelectedBadge}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span>·</span>
                      <span className={styles.fileSize}>{file.size}</span>
                      <CheckIcon
                        width={14}
                        height={14}
                        stroke="#34D399"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.docsNotice}>
                  <FileTextIcon width={15} height={15} stroke="#8F90A6" />
                  <span>
                    Place your configuration file at the root of the archive.{' '}
                    <a
                      href="https://ross.imdeepmind.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.docsLink}
                    >
                      Read the docs ↗
                    </a>
                  </span>
                </div>

                <div className={styles.actionFooter}>
                  <Link href="/dashboard" className={styles.cancelBtn}>
                    Cancel
                  </Link>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setStep(2)}
                  >
                    <span>Next</span>
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className={styles.cardTitle}>Configure your project</h2>
                <p className={styles.cardSubtitle}>
                  Name your project, add environment variables and choose
                  memory.
                </p>

                <div className={styles.formSection}>
                  {/* Project Name Field */}
                  <div className={styles.fieldGroup}>
                    <label htmlFor="projectName" className={styles.fieldLabel}>
                      Project name
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      className={styles.textInput}
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="e.g. blog-backend"
                    />
                    <span className={styles.slugPreview}>
                      {projectSlug}.rocket.app
                    </span>
                  </div>

                  {/* Environment Variables */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.sectionHeaderRow}>
                      <span className={styles.sectionTitle}>
                        Environment variables
                      </span>
                      <button
                        type="button"
                        className={styles.addVarBtn}
                        onClick={addEnvVar}
                      >
                        + Add variable
                      </button>
                    </div>
                    <span className={styles.sectionSubtitle}>
                      Database and cache URLs are injected for you.
                    </span>

                    <div className={styles.envVarList}>
                      {envVars.map(item => (
                        <div key={item.id} className={styles.envVarRow}>
                          <input
                            type="text"
                            className={styles.envKey}
                            value={item.key}
                            placeholder="KEY"
                            onChange={e =>
                              updateEnvVar(item.id, 'key', e.target.value)
                            }
                            readOnly={item.managed}
                          />

                          {item.managed ? (
                            <div className={styles.envValueManaged}>
                              <LockIcon
                                width={14}
                                height={14}
                                stroke="#8F90A6"
                              />
                              <span>Managed by Rocket</span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              className={styles.envValueInput}
                              value={item.value}
                              placeholder="Value"
                              onChange={e =>
                                updateEnvVar(item.id, 'value', e.target.value)
                              }
                            />
                          )}

                          <button
                            type="button"
                            className={styles.envDeleteBtn}
                            onClick={() => removeEnvVar(item.id)}
                            aria-label={`Remove ${item.key}`}
                          >
                            <TrashIcon width={16} height={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Memory Selection */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Memory</label>
                    <div className={styles.memoryGrid}>
                      <button
                        type="button"
                        className={[
                          styles.memoryCard,
                          memory === '256 MB' ? styles.memoryCardSelected : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setMemory('256 MB')}
                      >
                        {memory === '256 MB' && (
                          <span className={styles.memoryCardCheck}>
                            <CheckIcon
                              width={16}
                              height={16}
                              stroke="currentColor"
                              strokeWidth={2.5}
                            />
                          </span>
                        )}
                        <p className={styles.memoryTitle}>256 MB</p>
                        <p className={styles.memorySubtitle}>Light APIs</p>
                      </button>

                      <button
                        type="button"
                        className={[
                          styles.memoryCard,
                          memory === '512 MB' ? styles.memoryCardSelected : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setMemory('512 MB')}
                      >
                        {memory === '512 MB' && (
                          <span className={styles.memoryCardCheck}>
                            <CheckIcon
                              width={16}
                              height={16}
                              stroke="currentColor"
                              strokeWidth={2.5}
                            />
                          </span>
                        )}
                        <p className={styles.memoryTitle}>512 MB</p>
                        <p className={styles.memorySubtitle}>Recommended</p>
                      </button>

                      <button
                        type="button"
                        className={[
                          styles.memoryCard,
                          memory === '1 GB' ? styles.memoryCardSelected : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setMemory('1 GB')}
                      >
                        {memory === '1 GB' && (
                          <span className={styles.memoryCardCheck}>
                            <CheckIcon
                              width={16}
                              height={16}
                              stroke="currentColor"
                              strokeWidth={2.5}
                            />
                          </span>
                        )}
                        <p className={styles.memoryTitle}>1 GB</p>
                        <p className={styles.memorySubtitle}>High traffic</p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.actionFooter}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeftIcon width={16} height={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setStep(3)}
                  >
                    <span>Next</span>
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className={styles.cardTitle}>Review and deploy</h2>
                <p className={styles.cardSubtitle}>
                  Check your project details before deployment starts.
                </p>

                {/* Project Identity */}
                <div className={styles.reviewProjectIdentity}>
                  <div className={styles.projectAvatar}>{avatarInitial}</div>
                  <div className={styles.reviewProjectInfo}>
                    <span className={styles.reviewProjectName}>
                      {projectName}
                    </span>
                    <span className={styles.reviewProjectSlug}>
                      {projectSlug}.rocket.app
                    </span>
                  </div>
                </div>

                {/* Specs List */}
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Configuration</span>
                  <div className={styles.specValueWrapper}>
                    <span className={styles.specValue}>
                      {file.name} · {file.size}
                    </span>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setStep(1)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Memory</span>
                  <div className={styles.specValueWrapper}>
                    <span className={styles.specValue}>{memory}</span>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setStep(2)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className={styles.specRow}>
                  <span className={styles.specLabel}>
                    Environment variables
                  </span>
                  <div className={styles.specValueWrapper}>
                    <span className={styles.specValue}>
                      {totalEnvCount} ({managedCount} managed)
                    </span>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setStep(2)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Database</span>
                  <div className={styles.specValueWrapper}>
                    <span className={styles.specValue}>PostgreSQL</span>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setStep(2)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Cache</span>
                  <div className={styles.specValueWrapper}>
                    <span className={styles.specValue}>Redis</span>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setStep(2)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className={styles.actionFooter}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setStep(2)}
                  >
                    <ChevronLeftIcon width={16} height={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setStep(4)}
                  >
                    <span>Deploy project</span>
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* Right Column: Included with every project (4 lines as requested) */}
          <Card padding="none" className={styles.sideCard}>
            <h3 className={styles.sideCardTitle}>
              Included with every project
            </h3>
            <div className={styles.featureList}>
              {/* Line 1: Managed PostgreSQL */}
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <DatabaseIcon width={18} height={18} stroke="#FF6B85" />
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>Managed PostgreSQL</span>
                  <span className={styles.featureDesc}>
                    Provisioned automatically
                  </span>
                </div>
              </div>

              {/* Line 2: Managed Redis */}
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <ZapIcon width={18} height={18} stroke="#FF6B85" />
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>Managed Redis</span>
                  <span className={styles.featureDesc}>
                    Caching layer, no setup
                  </span>
                </div>
              </div>

              {/* Line 3: Server */}
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <LayersIcon width={18} height={18} stroke="#FF6B85" />
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>Server</span>
                  <span className={styles.featureDesc}>
                    Dedicated compute instance
                  </span>
                </div>
              </div>

              {/* Line 4: Analytics */}
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <ActivityIcon width={18} height={18} stroke="#FF6B85" />
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>Analytics</span>
                  <span className={styles.featureDesc}>
                    Real-time metrics & insights
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Step 4: Deploying View (Image 4) */
        <div className={styles.deployingGrid}>
          {/* Left Column: Progress & Logs */}
          <div className={styles.deployingLeftCol}>
            {/* Steps Progress Card */}
            <Card padding="none" className={styles.progressCard}>
              <div className={styles.progressHeader}>
                <span className={styles.progressStepCount}>
                  Step {deployStepIndex} of 4
                </span>
                <span className={styles.progressPercent}>
                  {deployProgress}%
                </span>
              </div>

              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{width: `${deployProgress}%`}}
                />
              </div>

              <div className={styles.deployStepsList}>
                {/* Step 1: Validating config */}
                <div className={styles.deployStepItem}>
                  <div className={styles.deployStepLeft}>
                    <div className={styles.deployStepIconCompleted}>
                      <CheckIcon
                        width={14}
                        height={14}
                        stroke="#34D399"
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className={styles.deployStepDetails}>
                      <span className={styles.deployStepName}>
                        Validating configuration
                      </span>
                      <span className={styles.deployStepDesc}>
                        ROSS configuration is valid
                      </span>
                    </div>
                  </div>
                  <span className={styles.deployStepStatus}>2s</span>
                </div>

                {/* Step 2: Provisioning database */}
                <div className={styles.deployStepItem}>
                  <div className={styles.deployStepLeft}>
                    <div className={styles.deployStepIconActive} />
                    <div className={styles.deployStepDetails}>
                      <span className={styles.deployStepName}>
                        Provisioning database
                      </span>
                      <span className={styles.deployStepDesc}>
                        Creating PostgreSQL and Redis
                      </span>
                    </div>
                  </div>
                  <span className={styles.deployStepStatus}>In progress</span>
                </div>

                {/* Step 3: Deploying code */}
                <div className={styles.deployStepItem}>
                  <div className={styles.deployStepLeft}>
                    <div className={styles.deployStepIconWaiting} />
                    <div className={styles.deployStepDetails}>
                      <span className={styles.deployStepNameMuted}>
                        Deploying code
                      </span>
                      <span className={styles.deployStepDesc}>
                        Building and releasing your service
                      </span>
                    </div>
                  </div>
                  <span className={styles.deployStepStatus}>Waiting</span>
                </div>

                {/* Step 4: Finalizing setup */}
                <div className={styles.deployStepItem}>
                  <div className={styles.deployStepLeft}>
                    <div className={styles.deployStepIconWaiting} />
                    <div className={styles.deployStepDetails}>
                      <span className={styles.deployStepNameMuted}>
                        Finalizing setup
                      </span>
                      <span className={styles.deployStepDesc}>
                        Assigning your URL and running health checks
                      </span>
                    </div>
                  </div>
                  <span className={styles.deployStepStatus}>Waiting</span>
                </div>
              </div>
            </Card>

            {/* Deployment Log Box */}
            <Card padding="none" className={styles.logCard}>
              <h3 className={styles.logLabel}>Deployment log</h3>
              <div className={styles.logConsole}>
                <p className={styles.logLine}>
                  10:42:01 Validating configuration...
                </p>
                <p className={styles.logLine}>
                  10:42:03 Configuration is valid
                </p>
                <p className={styles.logLine}>
                  10:42:04 Provisioning PostgreSQL...
                </p>
                <p className={styles.logLine}>10:42:06 Provisioning Redis...</p>
                <p className={styles.logLine}>
                  10:42:08 Waiting for database to accept connections
                  <span className={styles.logCursor}>|</span>
                </p>
              </div>
            </Card>
          </div>

          {/* Right Column: Project Info Summary */}
          <Card padding="none" className={styles.deploySummaryCard}>
            <div className={styles.deploySummaryHeader}>
              <div className={styles.projectAvatar}>{avatarInitial}</div>
              <div className={styles.reviewProjectInfo}>
                <span className={styles.deploySummaryName}>{projectName}</span>
                <span className={styles.deploySummarySlug}>{projectSlug}</span>
              </div>
            </div>

            <div className={styles.specRow}>
              <span className={styles.specLabel}>Configuration</span>
              <span className={styles.specValue}>{file.name}</span>
            </div>

            <div className={styles.specRow}>
              <span className={styles.specLabel}>Memory</span>
              <span className={styles.specValue}>{memory}</span>
            </div>

            <div className={styles.specRow}>
              <span className={styles.specLabel}>Database</span>
              <span className={styles.specValue}>PostgreSQL</span>
            </div>

            <div className={styles.specRow}>
              <span className={styles.specLabel}>Cache</span>
              <span className={styles.specValue}>Redis</span>
            </div>

            <div className={styles.specRow}>
              <span className={styles.specLabel}>URL</span>
              <span className={styles.specValue}>Assigned on completion</span>
            </div>

            <Link href="/dashboard" className={styles.backToProjectsBtn}>
              Back to projects
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}

export default CreateProject;
