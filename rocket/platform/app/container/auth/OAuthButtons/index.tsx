'use client';

import React, {useState} from 'react';

import {GithubIcon, GoogleIcon} from '@/app/icons';

import {signInWithSocial, SocialProvider} from '@/app/lib/auth';

import styles from './styles.module.css';

export interface OAuthButtonsProps {
  dividerText?: string;
}

export default function OAuthButtons({
  dividerText = 'or continue with email',
}: OAuthButtonsProps): React.JSX.Element {
  const [notice, setNotice] = useState<string | null>(null);

  async function handleOAuthClick(provider: SocialProvider) {
    setNotice(null);
    const result = await signInWithSocial(provider);
    if (!result.success && result.error) {
      setNotice(result.error);
    }
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
