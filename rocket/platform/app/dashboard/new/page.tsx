'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import React, {useState} from 'react';

import Button from '@/app/components/bits/Button';
import Card from '@/app/components/bits/Card';
import TextBox from '@/app/components/bits/TextBox';

import {GithubIcon, RocketIcon} from '@/app/icons';

import styles from '../styles.module.css';

export default function NewProjectPage(): React.JSX.Element {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [isDeploying, setIsDeploying] = useState(false);

  function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      router.push('/dashboard');
    }, 1000);
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/dashboard" style={{color: '#8F90A6'}}>
          Workspace
        </Link>
        <span>/</span>
        <Link href="/dashboard" style={{color: '#8F90A6'}}>
          Projects
        </Link>
        <span>/</span>
        <span className={styles.breadcrumbActive}>New</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Create a New Project</h1>
          <p className={styles.subtitle}>
            Deploy your backend from a Git repository or Rocket starter
            template.
          </p>
        </div>
      </div>

      <div style={{maxWidth: '680px'}}>
        <Card padding="lg">
          <form
            onSubmit={handleDeploy}
            style={{display: 'flex', flexDirection: 'column', gap: '20px'}}
          >
            <TextBox
              label="Project Name"
              placeholder="e.g. ecommerce-backend"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              hint="Unique identifier for your project endpoint"
              required
              fullWidth
            />

            <div>
              <TextBox
                label="Git Repository URL"
                placeholder="https://github.com/organization/repo"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                leftIcon={
                  <GithubIcon
                    width={16}
                    height={16}
                    fill="currentColor"
                    stroke="none"
                  />
                }
                hint="Public or private repository with a ROSS configuration"
                required
                fullWidth
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#C9C9D9',
                  marginBottom: '8px',
                }}
              >
                Target Region
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#111119',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#F7F7FA',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                <option value="us-east-1">
                  US East (N. Virginia) - us-east-1
                </option>
                <option value="us-west-2">US West (Oregon) - us-west-2</option>
                <option value="eu-central-1">
                  EU Central (Frankfurt) - eu-central-1
                </option>
                <option value="ap-southeast-1">
                  Asia Pacific (Singapore) - ap-southeast-1
                </option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Button href="/dashboard" variant="ghost" size="md">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isDeploying}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RocketIcon width={16} height={16} stroke="#FFFFFF" />
                {isDeploying ? 'Deploying...' : 'Deploy Project'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
