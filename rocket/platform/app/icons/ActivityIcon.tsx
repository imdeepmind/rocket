import React from 'react';

export function ActivityIcon(
  props: React.SVGProps<SVGSVGElement>,
): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF6B85"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 20V10M12 20V4M18 20v-7" />
    </svg>
  );
}
