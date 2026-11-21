'use client';

import {useRouter} from 'next/navigation';
import React, {useEffect} from 'react';

import {signOut, useSession} from '@/lib/auth/client';

import Box from '@/componentsV2/bits/Box';
import AppShell from '@/componentsV2/container/navigation/AppShell';

import styles from './styles.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element | null {
  const router = useRouter();
  const {data: session, isPending} = useSession();

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/auth/sign-in');
    }
  }, [session, isPending, router]);

  async function handleLogout() {
    await signOut();
    router.push('/auth/sign-in');
  }

  if (isPending) {
    return (
      <AppShell>
        <Box classNameOverride={styles.loadingContainer}>
          <Box classNameOverride={styles.spinner} />
        </Box>
      </AppShell>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = {
    name: session.user.name || 'Developer',
    email: session.user.email || 'developer@example.com',
  };

  return (
    <AppShell projectCount={3} user={user} onLogout={handleLogout}>
      {children}
    </AppShell>
  );
}
