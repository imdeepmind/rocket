'use client';

import React from 'react';

import Flex from '@/componentsV2/bits/Flex';
import Typography from '@/componentsV2/bits/Typography';
import SettingsForm from '@/componentsV2/container/settings/SettingsForm';
import Breadcrumb from '@/componentsV2/items/Breadcrumb';

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
