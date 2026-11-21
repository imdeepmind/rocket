import type {Meta, StoryObj} from '@storybook/react';

import ResetPasswordCard from './index';

const meta = {
  title: 'Container/Auth/ResetPasswordCard',
  component: ResetPasswordCard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ResetPasswordCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultInputForm: Story = {
  args: {
    mode: 'success',
    onSubmit: (p1, p2) => alert(`Reset password: ${p1} / ${p2}`),
  },
};

export const CompletedSuccess: Story = {
  args: {
    mode: 'success',
    isCompleted: true,
    onSubmit: () => {},
  },
};

export const ExpiredLinkError: Story = {
  args: {
    mode: 'error',
    onSubmit: () => {},
  },
};
