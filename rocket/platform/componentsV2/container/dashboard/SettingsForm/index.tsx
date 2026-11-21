'use client';

import React, {useState} from 'react';

import Alert from '@/componentsV2/bits/Alert';
import Button from '@/componentsV2/bits/Button';
import Card from '@/componentsV2/bits/Card';
import Select, {type SelectOption} from '@/componentsV2/bits/Select';
import TextBox from '@/componentsV2/bits/TextBox';
import Typography from '@/componentsV2/bits/Typography';

import styles from './styles.module.css';

export interface WorkspaceSettingsData {
  workspaceName: string;
  region: string;
}

export interface SettingsFormProps {
  initialData: WorkspaceSettingsData;
  onSave: (data: WorkspaceSettingsData) => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  onDeleteWorkspace?: () => void;
  classNameOverride?: string;
}

const REGION_OPTIONS: SelectOption[] = [
  {value: 'us-east-1', label: 'US East (N. Virginia)'},
  {value: 'us-west-2', label: 'US West (Oregon)'},
  {value: 'eu-central-1', label: 'EU Central (Frankfurt)'},
  {value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)'},
];

export default function SettingsForm({
  initialData,
  onSave,
  isSaving = false,
  saveSuccess = false,
  onDeleteWorkspace,
  classNameOverride,
}: SettingsFormProps): React.JSX.Element {
  const [formData, setFormData] = useState<WorkspaceSettingsData>(initialData);

  const containerClass = [styles.container, classNameOverride]
    .filter(Boolean)
    .join(' ');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className={containerClass}>
      {/* General Settings */}
      <Card padding="lg" classNameOverride={styles.card}>
        <div className={styles.cardHeader}>
          <Typography variant="h3">General Details</Typography>
          <Typography variant="body-sm" color="muted">
            Information and default hosting regions associated with your active
            workspace.
          </Typography>
        </div>

        {saveSuccess && (
          <Alert
            variant="success"
            title="Settings saved"
            message="Your workspace configuration has been updated successfully."
            classNameOverride={styles.alert}
          />
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <TextBox
            label="Workspace Name"
            placeholder="e.g. My Team"
            value={formData.workspaceName}
            onChange={e =>
              setFormData(prev => ({...prev, workspaceName: e.target.value}))
            }
            fullWidth
          />

          <Select
            label="Default Deployment Region"
            options={REGION_OPTIONS}
            value={formData.region}
            onChange={e =>
              setFormData(prev => ({...prev, region: e.target.value}))
            }
            fullWidth
          />

          <div className={styles.saveAction}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving || !formData.workspaceName.trim()}
            >
              {isSaving ? 'Saving changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card padding="lg" classNameOverride={styles.dangerCard}>
        <div className={styles.cardHeader}>
          <Typography variant="h3" classNameOverride={styles.dangerTitle}>
            Danger Zone
          </Typography>
          <Typography variant="body-sm" color="muted">
            Permanently delete this workspace and all its associated backend
            services and deployments. This action cannot be undone.
          </Typography>
        </div>

        <div className={styles.dangerAction}>
          <Button
            variant="ghost"
            size="md"
            onClick={onDeleteWorkspace}
            classNameOverride={styles.deleteButton}
          >
            Delete Workspace
          </Button>
        </div>
      </Card>
    </div>
  );
}
