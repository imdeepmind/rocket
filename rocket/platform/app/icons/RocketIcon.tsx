import React from 'react';

export function RocketIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3c3 2 5 5 5 9l-2 4H9l-2-4c0-4 2-7 5-9z" />
      <path d="M9 16l-2 5 5-2 5 2-2-5" />
    </svg>
  );
}

