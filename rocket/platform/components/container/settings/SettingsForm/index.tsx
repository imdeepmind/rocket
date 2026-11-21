'use client';

import React from 'react';

import Card from '@/components/bits/Card';
import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';

export interface WorkspaceSettingsData {
  workspaceName?: string;
  region?: string;
}

export interface SettingsFormProps {
  initialData?: WorkspaceSettingsData;
  onSave?: (data: WorkspaceSettingsData) => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  onDeleteWorkspace?: () => void;
  classNameOverride?: string;
}

export default function SettingsForm({
  classNameOverride,
}: SettingsFormProps): React.JSX.Element {
  return (
    <Card padding="lg" fullWidth classNameOverride={classNameOverride}>
      <Flex direction="column" align="center" justify="center" p="8" gap="2">
        <Typography variant="h3">Workspace Settings</Typography>
        <Typography variant="body" color="muted" align="center">
          Workspace settings and preferences will be configurable here.
        </Typography>
      </Flex>
    </Card>
  );
}
