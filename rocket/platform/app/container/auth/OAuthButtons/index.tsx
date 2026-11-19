'use client';

import React, { useState } from 'react';
import { GoogleIcon, GithubIcon } from '@/app/icons';
import styles from './styles.module.css';

export interface OAuthButtonsProps {
  dividerText?: string;
}

export default function OAuthButtons({
  dividerText = 'or continue with username',
}: OAuthButtonsProps): React.JSX.Element {
  const [notice, setNotice] = useState<string | null>(null);

  function handleOAuthClick(provider: 'Google' | 'GitHub') {
    setNotice(
      `${provider} OAuth login will connect when tokens are configured. Please use username and password below.`
    );
  }

  return (
    <div className={styles.oauthContainer}>
      <div className={styles.buttonGrid}>
        <button
          type="button"
          onClick={() => handleOAuthClick('Google')}
          className={styles.oauthButton}
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          <span>Google</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthClick('GitHub')}
          className={styles.oauthButton}
          aria-label="Continue with GitHub"
        >
          <GithubIcon width={18} height={18} />
          <span>GitHub</span>
        </button>
      </div>

      {notice && (
        <div className={styles.infoBanner} role="status">
          <span>{notice}</span>
          <button
            type="button"
            className={styles.closeBanner}
            onClick={() => setNotice(null)}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      {dividerText && (
        <div className={styles.divider}>
          <div className={styles.line} />
          <span className={styles.dividerText}>{dividerText}</span>
          <div className={styles.line} />
        </div>
      )}
    </div>
  );
}

