import React from 'react';

import Box from '@/components/bits/Box';
import Features from '@/components/container/landing/Features';
import Hero from '@/components/container/landing/Hero';
import HowItWorks from '@/components/container/landing/HowItWorks';
import NextStep from '@/components/container/landing/NextStep';
import OpenSource from '@/components/container/landing/OpenSource';
import ProjectsPreview from '@/components/container/landing/ProjectsPreview';
import WhyRocket from '@/components/container/landing/WhyRocket';
import Footer from '@/components/container/navigation/Footer';
import Navbar from '@/components/container/navigation/Navbar';

import styles from './page.module.css';

export default function Home(): React.JSX.Element {
  return (
    <Box as="main" classNameOverride={styles.wrapper}>
      {/* Header & Hero */}
      <Box classNameOverride={styles.heroWrapper}>
        <Navbar />
        <Hero />
      </Box>

      {/* Feature showcase */}
      <Features />

      {/* How it works steps */}
      <HowItWorks />

      {/* Projects & Activity dashboard preview */}
      <ProjectsPreview />

      {/* Why Rocket & CLI deployment preview */}
      <WhyRocket />

      {/* Open Source / Built on ROSS */}
      <OpenSource />

      {/* Call to action section */}
      <NextStep />

      {/* Site footer */}
      <Footer />
    </Box>
  );
}
