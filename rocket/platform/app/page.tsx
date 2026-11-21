import React from 'react';

import Box from '@/componentsV2/bits/Box';
import Features from '@/componentsV2/container/landing/Features';
import Hero from '@/componentsV2/container/landing/Hero';
import HowItWorks from '@/componentsV2/container/landing/HowItWorks';
import NextStep from '@/componentsV2/container/landing/NextStep';
import OpenSource from '@/componentsV2/container/landing/OpenSource';
import ProjectsPreview from '@/componentsV2/container/landing/ProjectsPreview';
import WhyRocket from '@/componentsV2/container/landing/WhyRocket';
import Footer from '@/componentsV2/container/navigation/Footer';
import Navbar from '@/componentsV2/container/navigation/Navbar';

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
