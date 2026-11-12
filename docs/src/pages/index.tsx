import React from 'react';
import LayoutProvider from '@theme/Layout/Provider';
import { PageMetadata } from '@docusaurus/theme-common';
import Navbar from '@site/src/components/Navbar';
import Hero from '@site/src/components/Hero';
import Features from '@site/src/components/Features';
import HowItWorks from '@site/src/components/HowItWorks';
import OpenSource from '@site/src/components/OpenSource';
import NextStep from '@site/src/components/NextStep';
import Footer from '@site/src/components/Footer';
import styles from './index.module.css';

export default function Home(): React.JSX.Element {
  return (
    <LayoutProvider>
      <PageMetadata
        title="ROSS - Backend API Builder"
        description="The open-source, configuration-driven backend API builder"
      />
      <main className={styles.wrapper}>
        {/* Background glow and Header */}
        <div className={styles.heroWrapper}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <Navbar />
          <Hero />
        </div>

        <Features />
        <HowItWorks />
        <OpenSource />
        <NextStep />
        <Footer />
      </main>
    </LayoutProvider>
  );
}
