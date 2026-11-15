import React from 'react';
import { ZapIcon, LayersIcon, ActivityIcon, CodeIcon } from '@/app/icons';
import styles from './styles.module.css';

interface FeatureItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: ZapIcon,
    title: 'Simple deployments',
    description:
      'Deploy your backend services through a straightforward workflow, without manually managing infrastructure.',
  },
  {
    icon: LayersIcon,
    title: 'Managed infrastructure',
    description:
      'Let Rocket handle the underlying infrastructure, including a managed PostgreSQL database and Redis or Memcached for caching.',
  },
  {
    icon: ActivityIcon,
    title: 'Deployment management',
    description:
      'Track deployments, monitor their status, and manage your services from one place.',
  },
  {
    icon: CodeIcon,
    title: 'Built for developers',
    description:
      'A straightforward platform designed around developer workflows, with minimal complexity.',
  },
];

export default function Features(): React.JSX.Element {
  return (
    <section id="features" className={`${styles.w} ${styles.featuresSection}`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Platform</div>
        <h2 className={styles.title}>
          Everything you need to get your backend running.
        </h2>
      </div>
      <div className={styles.featuresGrid}>
        {FEATURES.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.ic}>
                <IconComponent />
              </div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

