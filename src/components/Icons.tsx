/* Line icons drawn to one spec: 24px grid, 1.9 stroke, round caps. */

type P = { className?: string; filled?: boolean };
const base = (className = 'h-6 w-6') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const HomeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3.5 10.2 12 3.6l8.5 6.6V20a1 1 0 0 1-1 1h-4.6v-6h-5.8v6H4.5a1 1 0 0 1-1-1z" />
  </svg>
);

export const CompassIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z" />
  </svg>
);

export const PlusIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ListIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6h16M4 12h11M4 18h7" />
  </svg>
);

export const UserIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" />
  </svg>
);

export const HeartIcon = ({ className, filled }: P) => (
  <svg {...base(className)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.4S3.6 15.5 3.6 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.4 2.6c0 5.9-8.4 10.8-8.4 10.8z" />
  </svg>
);

export const CommentIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M20.4 12.2a7.9 7.9 0 0 1-11.6 7L3.6 20.4l1.2-5.2a7.9 7.9 0 1 1 15.6-3z" />
  </svg>
);

export const BookmarkIcon = ({ className, filled }: P) => (
  <svg {...base(className)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6.5 3.6h11a1 1 0 0 1 1 1v15.8l-6.5-4.3-6.5 4.3V4.6a1 1 0 0 1 1-1z" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const RefreshIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M20 11.5a8 8 0 1 1-2.4-5.4" />
    <path d="M20 4v4.4h-4.4" />
  </svg>
);

export const MoonIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M20 13.4A8 8 0 1 1 10.6 4a6.5 6.5 0 0 0 9.4 9.4z" />
  </svg>
);

export const SunIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="4.1" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
  </svg>
);

export const ChevronIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const PinIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const CameraIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3.6 8.4h3.1l1.5-2.2h7.6l1.5 2.2h3.1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.6" r="3.4" />
  </svg>
);
