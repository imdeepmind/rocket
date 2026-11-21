import React from 'react';

import Features from '@/container/landing/Features';
import Hero from '@/container/landing/Hero';
import HowItWorks from '@/container/landing/HowItWorks';
import NextStep from '@/container/landing/NextStep';
import OpenSource from '@/container/landing/OpenSource';
import Projects from '@/container/landing/Projects';
import WhyRocket from '@/container/landing/WhyRocket';

import Footer from '@/components/items/Footer';
import Navbar from '@/components/items/Navbar';

import styles from './page.module.css';

export default function Home(): React.JSX.Element {
  return (
    <main className={styles.wrapper}>
      {/* Header & Hero */}
      <div className={styles.heroWrapper}>
        <Navbar />
        <Hero />
      </div>

      {/* Feature showcase */}
      <Features />

      {/* How it works steps */}
      <HowItWorks />

      {/* Projects & Activity dashboard preview */}
      <Projects />

      {/* Why Rocket & CLI deployment preview */}
      <WhyRocket />

      {/* Open Source / Built on ROSS */}
      <OpenSource />

      {/* Call to action section */}
      <NextStep />

      {/* Site footer */}
      <Footer />
    </main>
  );
}
