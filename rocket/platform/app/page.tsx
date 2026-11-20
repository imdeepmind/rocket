import React from 'react';

import Features from '@/app/container/landing/Features';
import Hero from '@/app/container/landing/Hero';
import HowItWorks from '@/app/container/landing/HowItWorks';
import NextStep from '@/app/container/landing/NextStep';
import OpenSource from '@/app/container/landing/OpenSource';
import Projects from '@/app/container/landing/Projects';
import WhyRocket from '@/app/container/landing/WhyRocket';

import Footer from '@/app/components/items/Footer';
import Navbar from '@/app/components/items/Navbar';

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
