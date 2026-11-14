import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'ROSS',
  tagline: 'Configuration-driven API framework',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://imdeepmind.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'imdeepmind', // Usually your GitHub org/user name.
  projectName: 'rocket', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  clientModules: ['./src/clientModules/mermaid-transition.js'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs', // Serve the docs at /docs
          editUrl:
            'https://github.com/imdeepmind/rocket/tree/main/ross/docs/',
        },
        blog: false, // Optional: disable the blog plugin
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'ROSS',
      logo: {
        alt: 'ROSS Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          to: '/',
          position: 'left',
          label: 'Home',
          exact: true,
        },
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://imdeepmind.com/blog',
          position: 'left',
          label: 'Blogs',
        },
        {
          href: 'https://github.com/imdeepmind/rocket',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/imdeepmind/rocket',
            },
            {
              label: 'Blogs',
              href: 'https://imdeepmind.com/blog',
            }
          ],
        },
        {
          title: 'imdeepmind',
          items: [
            {
              label: 'imdeepmind',
              href: 'https://imdeepmind.com',
            },
            {
              label: "abhishek@imdeepmind.com",
              href: "mailto:abhishek@imdeepmind.com"
            }
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ROSS. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
