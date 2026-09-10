import type { OAuthProvider } from '../../lib/auth/types';

/**
 * The official marks. Both Google and Apple require their own logo on a
 * sign-in button, so these are drawn to their published paths rather than
 * replaced with a generic icon.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.72c-.03-2.7 2.2-4 2.3-4.06-1.25-1.83-3.2-2.08-3.89-2.11-1.66-.17-3.24.97-4.08.97-.84 0-2.14-.95-3.52-.92-1.81.03-3.48 1.05-4.41 2.67-1.88 3.26-.48 8.09 1.35 10.74.9 1.3 1.97 2.75 3.38 2.7 1.36-.05 1.87-.87 3.51-.87 1.64 0 2.1.87 3.53.85 1.46-.03 2.38-1.32 3.27-2.62 1.03-1.5 1.46-2.96 1.48-3.03-.03-.02-2.84-1.09-2.87-4.32M14.4 4.76c.74-.9 1.24-2.15 1.1-3.4-1.07.05-2.36.72-3.13 1.61-.69.79-1.29 2.06-1.13 3.28 1.19.09 2.41-.61 3.16-1.49" />
    </svg>
  );
}

const MARKS: Record<OAuthProvider, () => JSX.Element> = {
  google: GoogleMark,
  apple: AppleMark,
};

const LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
};

export function ProviderButton({
  provider,
  disabled,
  onClick,
}: {
  provider: OAuthProvider;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Mark = MARKS[provider];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl2 border border-line bg-surface py-3 text-sm font-extrabold text-text transition active:scale-[0.99] disabled:opacity-60"
    >
      <Mark />
      {LABELS[provider]}
    </button>
  );
}
