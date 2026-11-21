'use client';

import React from 'react';

import SettingsForm from '@/components/container/settings/SettingsForm';

import Flex from '@/components/bits/Flex';
import Typography from '@/components/bits/Typography';
import Breadcrumb from '@/components/items/Breadcrumb';

export default function SettingsPage(): React.JSX.Element {
  return (
    <>
      <Breadcrumb
        items={[
          {label: 'Workspace', href: '/dashboard'},
          {label: 'Settings', active: true},
        ]}
      />

      <Flex direction="column" gap="1" mt="4" mb="7">
        <Typography variant="h1">Workspace Settings</Typography>
        <Typography variant="body" color="muted">
          Manage workspace preferences, regions, and environment keys.
        </Typography>
      </Flex>

      <SettingsForm />
    </>
  );
}
