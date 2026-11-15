import React from 'react';
import Navbar from '@/app/components/items/Navbar';
import Footer from '@/app/components/items/Footer';
import Hero from '@/app/container/landing/Hero';
import Features from '@/app/container/landing/Features';
import HowItWorks from '@/app/container/landing/HowItWorks';
import Projects from '@/app/container/landing/Projects';
import WhyRocket from '@/app/container/landing/WhyRocket';
import OpenSource from '@/app/container/landing/OpenSource';
import NextStep from '@/app/container/landing/NextStep';
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
