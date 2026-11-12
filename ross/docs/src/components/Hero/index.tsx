import React from 'react';
import Link from '@docusaurus/Link';
import { ArrowRightIcon } from '@site/src/icons';
import styles from './styles.module.css';

export default function Hero(): React.JSX.Element {
  return (
    <section className={`${styles.w} ${styles.heroSection}`}>
      <div className={styles.heroContent}>
        <div className={styles.heroTag}>
          <span className={styles.tagPulse} />
          Open source · MIT
        </div>
        <h1 className={styles.heroTitle}>
          Build your backend with <span style={{ color: 'var(--ifm-color-primary)' }}>ROSS</span>
        </h1>
        <p className={styles.heroSubtitle}>
          The open-source, configuration-driven backend API builder. Define your
          backend, generate APIs, and ship faster, with minimal effort.
        </p>
        <div className={styles.ctaGroup}>
          <Link className={styles.btn} to="/docs/get-started">
            Get started <ArrowRightIcon />
          </Link>
          <Link className={`${styles.btn} ${styles.ghost}`} to="/docs">
            Read the docs
          </Link>
        </div>
      </div>

      <div className={styles.heroCodeCol}>
        <div className={`${styles.glass} ${styles.mono} ${styles.codeWindow}`}>
          <div className={styles.windowDots}>
            <span className={styles.windowDot} style={{ background: '#FF5F57' }} />
            <span className={styles.windowDot} style={{ background: '#FEBC2E' }} />
            <span className={styles.windowDot} style={{ background: '#28C840' }} />
          </div>
          <div className={styles.codeFileName}>barebone_config.json</div>
          <div className={styles.codeContent}>
            {'{'}{'\n'}
            {'  '}&quot;application&quot;: {'{ '}&quot;name&quot;: <span style={{ color: '#FBBF24' }}>&quot;Barebone API&quot;</span> {'}'},{'\n'}
            {'  '}&quot;data&quot;: {'{\n'}
            {'    '}&quot;models&quot;: {'{\n'}
            {'      '}&quot;notes&quot;: {'{\n'}
            {'        '}&quot;fields&quot;: {'{\n'}
            {'          '}&quot;id&quot;: {'{ '}&quot;type&quot;: <span style={{ color: '#FBBF24' }}>&quot;integer&quot;</span>, &quot;primaryKey&quot;: <span style={{ color: '#FF6B85' }}>true</span>, &quot;apis&quot;: [<span style={{ color: '#FBBF24' }}>&quot;edit&quot;</span>] {'}'},{'\n'}
            {'          '}&quot;title&quot;: {'{ '}&quot;type&quot;: <span style={{ color: '#FBBF24' }}>&quot;string&quot;</span>, &quot;apis&quot;: [<span style={{ color: '#FBBF24' }}>&quot;search&quot;</span>] {'}'},{'\n'}
            {'          '}&quot;body&quot;: {'{ '}&quot;type&quot;: <span style={{ color: '#FBBF24' }}>&quot;text&quot;</span> {'}'}{'\n'}
            {'        '}{'}'}{'\n'}
            {'      '}{'}'}{'\n'}
            {'    '}{'}'}{'\n'}
            {'  '}{'}'}{'\n'}
            {'}'}
          </div>
        </div>

        <div className={`${styles.glass} ${styles.apiFloatingCard}`}>
          <div className={styles.apiCardHeader}>Generated APIs</div>
          <div className={`${styles.rt} ${styles.mono}`}>
            <span>/notes</span>
            <span className={styles.pillGroup}>
              <span className={styles.pill}>GET</span>
              <span className={styles.pill}>POST</span>
            </span>
          </div>
          <div className={`${styles.rt} ${styles.mono}`}>
            <span>/notes/id/:id</span>
            <span className={styles.pillGroup}>
              <span className={styles.pill}>GET</span>
              <span className={styles.pill}>PUT</span>
            </span>
          </div>
          <div className={`${styles.rt} ${styles.mono}`}>
            <span>/notes/search/title</span>
            <span className={styles.pillGroup}>
              <span className={styles.pill}>GET</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

