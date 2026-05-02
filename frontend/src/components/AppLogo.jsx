import React from 'react';

const markSizes = {
  xs: 'h-9 w-9 rounded-xl text-[0.8rem]',
  sm: 'h-11 w-11 rounded-2xl text-[0.95rem]',
  md: 'h-14 w-14 rounded-[1.35rem] text-[1.15rem]',
  lg: 'h-16 w-16 rounded-[1.55rem] text-[1.35rem]',
};

const wordSizes = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

export function AppLogoMark({ size = 'md', animated = true, className = '' }) {
  return (
    <span
      className={`${markSizes[size] || markSizes.md} app-logo-mark relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white font-black text-white shadow-xl shadow-violet-500/20 ring-1 ring-violet-100 dark:bg-slate-950 dark:ring-white/10 ${animated ? 'app-logo-mark--float' : ''} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(168,85,247,0.18),transparent_35%),radial-gradient(circle_at_80%_78%,rgba(236,72,153,0.13),transparent_34%)]" />
      <span className="app-logo-sweep absolute inset-0 opacity-70" />
      <svg className="relative z-10 h-[82%] w-[82%]" viewBox="0 0 96 96" role="img" aria-label="StudentHub">
        <defs>
          <linearGradient id="studenthubMarkGradient" x1="18" y1="14" x2="78" y2="86" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A855F7" />
            <stop offset="0.52" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#4C1D95" />
          </linearGradient>
          <linearGradient id="studenthubMarkGlow" x1="20" y1="20" x2="76" y2="74" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C084FC" />
            <stop offset="1" stopColor="#6D28D9" />
          </linearGradient>
        </defs>
        <path
          d="M26 28.5 46.8 16.4a16 16 0 0 1 16.1 0l20.8 12.1a16 16 0 0 1 7.9 13.8v19.9a16 16 0 0 1-8 13.8L62.8 87.9a16 16 0 0 1-16 0L26 76a16 16 0 0 1-8-13.8V42.3a16 16 0 0 1 8-13.8Z"
          fill="none"
          stroke="url(#studenthubMarkGradient)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M19.5 61.5c13.6 1.6 25.6 7.1 35.7 16.4v11.5c-12.4-9.4-24.7-15.5-36.7-18.5a8 8 0 0 1-6-7.7 2 2 0 0 1 2.4-2Z"
          fill="url(#studenthubMarkGradient)"
        />
        <path
          d="M76.5 61.5C63 63.1 51 68.6 40.8 77.9v11.5c12.4-9.4 24.7-15.5 36.7-18.5a8 8 0 0 0 6-7.7 2 2 0 0 0-2.4-2Z"
          fill="url(#studenthubMarkGradient)"
          opacity="0.92"
        />
        <circle cx="48" cy="47.5" r="11.8" fill="url(#studenthubMarkGlow)" />
        <circle cx="30.5" cy="51.8" r="8.2" fill="url(#studenthubMarkGlow)" opacity="0.9" />
        <circle cx="65.5" cy="51.8" r="8.2" fill="url(#studenthubMarkGlow)" opacity="0.9" />
        <path
          d="M19 21.5h31.5c8.1 0 14.7 6 14.7 13.4 0 6.2-4.6 11.4-10.9 12.9v9.3L42.8 48.2H19c-8.1 0-14.7-6-14.7-13.3s6.6-13.4 14.7-13.4Z"
          fill="white"
          stroke="url(#studenthubMarkGradient)"
          strokeWidth="5.2"
          strokeLinejoin="round"
        />
        <circle cx="22.5" cy="34.8" r="3.2" fill="#7C3AED" />
        <circle cx="34.8" cy="34.8" r="3.2" fill="#7C3AED" />
        <circle cx="47.1" cy="34.8" r="3.2" fill="#7C3AED" />
      </svg>
    </span>
  );
}

export function AppWordmark({ size = 'md', subtitle = true, tone = 'default', className = '' }) {
  const titleTone = tone === 'inverse' ? 'text-white' : 'text-gray-950 dark:text-white';
  const subtitleTone = tone === 'inverse' ? 'text-white/45' : 'text-gray-500 dark:text-gray-400';

  return (
    <span className={`min-w-0 ${className}`}>
      <span className={`${wordSizes[size] || wordSizes.md} ${titleTone} block truncate font-black tracking-normal drop-shadow-sm`}>
        Student<span className="bg-gradient-to-r from-cyan-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Hub</span>
      </span>
      {subtitle && (
        <span className={`${subtitleTone} mt-0.5 block truncate text-[10px] font-black uppercase tracking-normal`}>
          Chat - Collaborate - Create
        </span>
      )}
    </span>
  );
}

export default function AppLogo({ size = 'md', wordSize = 'md', subtitle = true, animated = true, tone = 'default', className = '' }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
      <AppLogoMark size={size} animated={animated} />
      <AppWordmark size={wordSize} subtitle={subtitle} tone={tone} />
    </span>
  );
}
