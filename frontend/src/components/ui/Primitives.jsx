import React from 'react';

const toneClasses = {
  blue: 'bg-blue-50 text-[#1877f2] dark:bg-blue-950/30 dark:text-blue-200',
  slate: 'bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-200',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'
};

export function Panel({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function IconBadge({ icon: Icon, tone = 'blue', className = '', size = 21 }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClasses[tone] || toneClasses.blue} ${className}`}>
      <Icon size={size} />
    </span>
  );
}

export function PrimaryButton({ as: Component = 'button', className = '', children, ...props }) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877f2] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0f63d5] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
