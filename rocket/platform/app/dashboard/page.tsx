'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useEffect, useState} from 'react';

import Button from '@/app/components/bits/Button';

import {
  ActivityIcon,
  CheckIcon,
  LayersIcon,
  RocketIcon,
  ZapIcon,
} from '@/app/icons';

import {signOut, useSession} from '@/app/lib/auth/client';

import styles from './styles.module.css';

interface ServiceItem {
  id: string;
  name: string;
  environment: 'Production' | 'Staging' | 'Preview';
  status: 'Live' | 'Building';
  endpoint: string;
  region: string;
  updated: string;
}

const DUMMY_SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'rocket-api-gateway',
    environment: 'Production',
    status: 'Live',
    endpoint: 'api.rocket.dev/v1',
    region: 'us-east-1',
    updated: '12m ago',
  },
  {
    id: 'srv-2',
    name: 'auth-microservice',
    environment: 'Production',
    status: 'Live',
    endpoint: 'auth.rocket.dev',
    region: 'eu-central-1',
    updated: '2h ago',
  },
  {
    id: 'srv-3',
    name: 'billing-events-worker',
    environment: 'Production',
    status: 'Live',
    endpoint: 'billing.rocket.dev',
    region: 'us-west-2',
    updated: '1d ago',
  },
  {
    id: 'srv-4',
    name: 'search-vector-indexer',
    environment: 'Preview',
    status: 'Building',
    endpoint: 'preview-vector.rocket.dev',
    region: 'us-east-1',
    updated: 'Just now',
  },
];

export default function DashboardPage(): React.JSX.Element | null {
  const router = useRouter();
  const {data: session, isPending} = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/auth/sign-in');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.ambientGlow} aria-hidden="true" />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const displayName = user.name || user.email?.split('@')[0] || 'Developer';
  const initial = (displayName.charAt(0) || 'D').toUpperCase();

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.push('/auth/sign-in');
      router.refresh();
    } catch (err) {
      console.error('Failed to log out:', err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.ambientGlow} aria-hidden="true" />

      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <Link href="/" className={styles.brand}>
            <Image
              src="/logo.png"
              alt="Rocket Logo"
              width={28}
              height={28}
              style={{
                objectFit: 'contain',
                display: 'block',
                borderRadius: '6px',
              }}
            />
            Rocket
          </Link>
          <span className={styles.brandBadge}>Dashboard</span>
        </div>

        <nav className={styles.navLinks}>
          <Link
            href="/dashboard"
            className={`${styles.navLink} ${styles.navLinkActive}`}
          >
            Overview
          </Link>
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
          <Link href="/docs" className={styles.navLink}>
            Docs
          </Link>
          <Link href="/pricing" className={styles.navLink}>
            Pricing
          </Link>
        </nav>

        <div className={styles.userActions}>
          <div className={styles.userBadge}>
            <div className={styles.avatar}>{initial}</div>
            <span>{displayName}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </header>

      {/* Dashboard Body */}
      <main className={styles.mainContent}>
        {/* Header Row */}
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>Welcome back, {displayName}</h1>
            <p className={styles.pageSubtitle}>
              Here is what is happening across your backend services and
              deployments today.
            </p>
          </div>

          <div className={styles.headerRight}>
            <Button variant="ghost" size="md" href="/docs">
              Documentation
            </Button>
            <Button variant="primary" size="md">
              + New Service
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span>Active Deployments</span>
              <RocketIcon width={16} height={16} />
            </div>
            <div className={styles.statValue}>12</div>
            <div className={styles.statChange}>
              <CheckIcon width={14} height={14} />
              <span>3 production, 9 preview</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span>Total API Requests</span>
              <ActivityIcon width={16} height={16} />
            </div>
            <div className={styles.statValue}>2.4M</div>
            <div className={styles.statChange}>
              <span>+14.2% from last week</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span>Average Latency</span>
              <ZapIcon width={16} height={16} />
            </div>
            <div className={styles.statValue}>34ms</div>
            <div className={styles.statChange}>
              <span>Global edge distribution</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span>Platform Uptime</span>
              <LayersIcon width={16} height={16} />
            </div>
            <div className={styles.statValue}>99.99%</div>
            <div className={styles.statChange}>
              <span>All systems operational</span>
            </div>
          </div>
        </section>

        {/* Two Columns: Services Table + CLI / Activity */}
        <div className={styles.gridTwoCols}>
          {/* Services Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Deployed Services</h2>
                <p className={styles.cardDescription}>
                  Real-time status of your connected backend APIs
                </p>
              </div>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_SERVICES.map(srv => (
                  <tr key={srv.id}>
                    <td>
                      <div className={styles.serviceName}>{srv.name}</div>
                      <div className={styles.endpoint}>{srv.endpoint}</div>
                    </td>
                    <td>{srv.environment}</td>
                    <td>
                      <span
                        className={
                          srv.status === 'Live'
                            ? styles.statusLive
                            : styles.statusDeploying
                        }
                      >
                        {srv.status}
                      </span>
                    </td>
                    <td style={{color: '#a9a9bb'}}>{srv.region}</td>
                    <td style={{color: '#a9a9bb'}}>{srv.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Deploy & Activity */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Deploy via CLI</h2>
                  <p className={styles.cardDescription}>
                    Quick start with Rocket
                  </p>
                </div>
              </div>

              <div className={styles.cliSnippet}>
                <span># Install Rocket CLI</span>
                <span className={styles.cliCommand}>
                  npm i -g @imdeepmind/rocket
                </span>
                <span style={{marginTop: '6px'}}>
                  # Deploy current directory
                </span>
                <span className={styles.cliCommand}>rocket deploy --prod</span>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Recent Activity</h2>
                  <p className={styles.cardDescription}>Audit log of changes</p>
                </div>
              </div>

              <div className={styles.activityList}>
                <div className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div>
                    <div className={styles.activityText}>
                      Deployment #142 live on rocket-api-gateway
                    </div>
                    <div className={styles.activityTime}>12 minutes ago</div>
                  </div>
                </div>

                <div className={styles.activityItem}>
                  <div
                    className={styles.activityDot}
                    style={{backgroundColor: '#10b981'}}
                  />
                  <div>
                    <div className={styles.activityText}>
                      Auto-scaled EU cluster to 4 instances
                    </div>
                    <div className={styles.activityTime}>2 hours ago</div>
                  </div>
                </div>

                <div className={styles.activityItem}>
                  <div
                    className={styles.activityDot}
                    style={{backgroundColor: '#8b5cf6'}}
                  />
                  <div>
                    <div className={styles.activityText}>
                      Automated daily database backup snapshot
                    </div>
                    <div className={styles.activityTime}>6 hours ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
