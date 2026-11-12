import React from 'react';

export function WebhookIcon(
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
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="12" cy="6" r="2.5" />
      <path d="M12 8.5v3.5M8 16l3-4M16 16l-3-4" />
    </svg>
  );
}

export default WebhookIcon;

