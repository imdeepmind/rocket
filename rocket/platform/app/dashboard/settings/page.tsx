'use client';

import React, {useState} from 'react';

import Button from '@/app/components/bits/Button';
import Card from '@/app/components/bits/Card';
import TextBox from '@/app/components/bits/TextBox';

import styles from '../styles.module.css';

export default function SettingsPage(): React.JSX.Element {
  const [workspaceName, setWorkspaceName] = useState('Abhishek');
  const [region, setRegion] = useState('us-east-1');

  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span>Workspace</span>
        <span>/</span>
        <span className={styles.breadcrumbActive}>Settings</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Workspace Settings</h1>
          <p className={styles.subtitle}>
            Manage workspace preferences, regions, and environment keys.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '720px',
        }}
      >
        {/* General Details Card */}
        <Card padding="lg">
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '6px',
              color: '#F7F7FA',
            }}
          >
            General Details
          </h2>
          <p style={{fontSize: '13px', color: '#8F90A6', marginBottom: '20px'}}>
            Information associated with your active workspace.
          </p>

          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <TextBox
              label="Workspace Name"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              fullWidth
            />

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
                Default Deployment Region
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
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-central-1">EU Central (Frankfurt)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>

            <div style={{marginTop: '8px'}}>
              <Button variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card padding="lg" style={{borderColor: 'rgba(225, 29, 72, 0.3)'}}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '6px',
              color: '#FB7185',
            }}
          >
            Danger Zone
          </h2>
          <p style={{fontSize: '13px', color: '#8F90A6', marginBottom: '16px'}}>
            Permanently delete this workspace and all its associated backend
            services.
          </p>

          <Button
            variant="ghost"
            size="sm"
            style={{
              color: '#FB7185',
              borderColor: 'rgba(225, 29, 72, 0.4)',
              background: 'rgba(225, 29, 72, 0.08)',
            }}
          >
            Delete Workspace
          </Button>
        </Card>
      </div>
    </>
  );
}
