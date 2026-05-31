import type { SVGProps } from 'react';

// Inline SVG icons (no emoji). Color is via currentColor; each card state pairs an icon
// with a label so color is never the only signal (color-blind accessibility).

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

/** Agent / team operative glyph (shield). */
export function AgentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6l7-3z" />
    </svg>
  );
}

/** Neutral bystander glyph (dash in a circle). */
export function NeutralIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  );
}

/** Assassin glyph (skull). */
export function AssassinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2a8 8 0 0 0-8 8v4l2 2v3h12v-3l2-2v-4a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" />
      <path d="M10 17v2M14 17v2" />
    </svg>
  );
}

/** Spymaster glyph (eye). */
export function SpymasterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
