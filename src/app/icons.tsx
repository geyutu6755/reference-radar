interface IconProps {
  width?: number;
  height?: number;
  className?: string;
}

export function RadarLogo({ width = 28, height = 28, className }: IconProps): React.ReactNode {
  return (
    <svg viewBox="0 0 64 64" width={width} height={height} className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="var(--rr-primary)" />
      <circle cx="32" cy="26" r="12" fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.9" />
      <circle cx="32" cy="26" r="5" fill="#fff" />
      <path d="M32 26 L46 44" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M14 44 L24 36" stroke="#9cc3ff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <path d="M50 44 L44 38" stroke="#9cc3ff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function GithubIcon({ width = 18, height = 18, className }: IconProps): React.ReactNode {
  return (
    <svg viewBox="0 0 16 16" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function ShieldIcon({ width = 24, height = 24, className }: IconProps): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="none" stroke="var(--rr-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
