import React from 'react';
import {
  LayersIcon,
  ZapIcon,
  CodeIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  WebhookIcon,
} from '@site/src/icons';
import styles from './styles.module.css';

interface FeatureItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: LayersIcon,
    title: 'Model definitions',
    description: 'Define your data models with a simple, declarative configuration.',
  },
  {
    icon: ZapIcon,
    title: 'Automatic CRUD APIs',
    description: 'Get fully functional APIs for your models, out of the box.',
  },
  {
    icon: CodeIcon,
    title: 'Custom endpoints',
    description: 'Add your own business logic with ease.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Authentication & RBAC',
    description: 'Secure your APIs with multiple auth methods and role-based access.',
  },
  {
    icon: DatabaseIcon,
    title: 'Database integrations',
    description: 'Work with SQLite or PostgreSQL.',
  },
  {
    icon: WebhookIcon,
    title: 'Webhooks, analytics & more',
    description: 'Enable integrations and track usage.',
  },
];

export default function Features(): React.JSX.Element {
  return (
    <section id="features" className={`${styles.w} ${styles.featuresSection}`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Features</div>
        <h2 className={styles.title}>
          A powerful, flexible backend framework.
        </h2>
      </div>
      <div className={styles.featuresGrid}>
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.ic}>
                <Icon />
              </div>
              <h3 className={styles.featureTitle}>
                {feature.title}
              </h3>
              <p className={styles.featureDescription}>
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

