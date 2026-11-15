import React from 'react';
import Navbar from '@/app/components/Navbar';
import Hero from '@/app/components/Hero';
import Features from '@/app/components/Features';
import HowItWorks from '@/app/components/HowItWorks';
import Projects from '@/app/components/Projects';
import WhyRocket from '@/app/components/WhyRocket';
import OpenSource from '@/app/components/OpenSource';
import NextStep from '@/app/components/NextStep';
import Footer from '@/app/components/Footer';
import styles from './page.module.css';

export default function Home(): React.JSX.Element {
  return (
    <main className={styles.wrapper}>
      {/* Ambient top hero glow, Header & Hero */}
      <div className={styles.heroWrapper}>
        <div className={styles.heroGlow} aria-hidden="true" />
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
