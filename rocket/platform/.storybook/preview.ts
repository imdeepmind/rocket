import type {Preview} from '@storybook/react';

import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {name: 'dark', value: '#08080d'},
        {name: 'surface', value: '#171722'},
        {name: 'light', value: '#ffffff'},
      ],
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
