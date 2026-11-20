'use client';

import {useRouter} from 'next/navigation';
import React, {useEffect} from 'react';

import AppShell from '@/app/components/items/AppShell';

import {useSession} from '@/app/lib/auth/client';

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

  if (isPending) {
    return (
      <AppShell>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </AppShell>
    );
  }

  if (!session?.user) {
    return null;
  }

  return <AppShell projectCount={3}>{children}</AppShell>;
}
