import React from 'react';

import Typography from '@/componentsV2/bits/Typography';
import TerminalViewer from '@/componentsV2/items/TerminalViewer';

import styles from './styles.module.css';

export const DEFAULT_BENEFITS = [
  'Less infrastructure setup',
  'Simplified deployment lifecycle',
  'Centralized deployment management',
  'A straightforward developer experience',
  'PostgreSQL and Redis/Memcached included',
];

export const DEFAULT_TERMINAL_LINES = [
  '# Deploy with just a few lines',
  '$ rocket deploy --project my-app',
  '✓ Deployed successfully in 42s',
];

export interface WhyRocketProps {
  eyebrow?: string;
  title?: string;
  benefits?: string[];
  terminalTitle?: string;
  terminalLines?: string[];
  classNameOverride?: string;
}

export default function WhyRocket({
  eyebrow = 'Why Rocket',
  title = 'Spend less time managing infrastructure.',
  benefits = DEFAULT_BENEFITS,
  terminalTitle = 'bash — deploy',
  terminalLines = DEFAULT_TERMINAL_LINES,
  classNameOverride,
}: WhyRocketProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.whySection;

  return (
    <section id="docs" className={combinedClass}>
      {/* Left: CLI terminal preview */}
      <div className={styles.terminalCol}>
        <TerminalViewer
          title={terminalTitle}
          lines={terminalLines}
          activeCursor
          showDots
        />
      </div>

      {/* Right: Why Rocket info */}
      <div className={styles.infoCol}>
        {eyebrow && <Typography variant="eyebrow">{eyebrow}</Typography>}
        <Typography variant="h2" as="h2" classNameOverride={styles.title}>
          {title}
        </Typography>

        <ul className={styles.checkList}>
          {benefits.map(benefit => (
            <li key={benefit} className={styles.checkItem}>
              <span className={styles.checkDot} aria-hidden="true">
                ✓
              </span>
              <Typography variant="body" as="span">
                {benefit}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
