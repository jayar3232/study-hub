import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Heart,
  Cloud,
  Zap
} from 'lucide-react';

/**
 * AuthBackground
 * A reusable, animated white + blue background with floating icons, soft blobs,
 * and a subtle grid. Designed for the Login & Register pages.
 */
export const AuthBackground = () => {
  // Floating icon configuration
  const floatingIcons = [
    { Icon: BookOpen,       top: '8%',  left: '6%',   delay: 0,    size: 28, color: 'text-blue-400/70',   blur: false },
    { Icon: GraduationCap,  top: '15%', left: '88%',  delay: 0.6,  size: 34, color: 'text-sky-500/70',    blur: false },
    { Icon: MessageCircle,  top: '70%', left: '5%',   delay: 1.2,  size: 30, color: 'text-blue-500/70',   blur: false },
    { Icon: ShoppingBag,    top: '78%', left: '92%',  delay: 0.3,  size: 26, color: 'text-indigo-400/70', blur: false },
    { Icon: ShieldCheck,    top: '40%', left: '3%',   delay: 1.8,  size: 24, color: 'text-cyan-500/70',   blur: false },
    { Icon: Sparkles,       top: '30%', left: '95%',  delay: 0.9,  size: 22, color: 'text-blue-400/80',   blur: false },
    { Icon: Star,           top: '55%', left: '93%',  delay: 1.4,  size: 20, color: 'text-sky-400/80',    blur: false },
    { Icon: Heart,          top: '88%', left: '45%',  delay: 0.5,  size: 22, color: 'text-blue-300/70',   blur: true  },
    { Icon: Cloud,          top: '5%',  left: '45%',  delay: 1.1,  size: 30, color: 'text-blue-200/80',   blur: true  },
    { Icon: Zap,            top: '60%', left: '50%',  delay: 2.0,  size: 18, color: 'text-cyan-400/60',   blur: true  }
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base radial gradient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.16),transparent_55%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,1),rgba(239,246,255,1))]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />

      {/* Animated blobs */}
      <motion.div
        className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-blue-400/40 via-sky-300/30 to-transparent blur-3xl"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-indigo-400/35 via-blue-300/25 to-transparent blur-3xl"
        animate={{ x: [0, -50, 30, 0], y: [0, -40, 20, 0], scale: [1, 1.08, 0.92, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 h-[20rem] w-[20rem] rounded-full bg-gradient-to-br from-cyan-300/30 via-sky-200/20 to-transparent blur-3xl"
        animate={{ x: [0, 40, -30, 0], y: [0, -50, 30, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating icons */}
      {floatingIcons.map(({ Icon, top, left, delay, size, color, blur }, index) => (
        <motion.div
          key={index}
          className={`absolute ${color} ${blur ? 'blur-[1px]' : ''} drop-shadow-[0_4px_12px_rgba(59,130,246,0.25)]`}
          style={{ top, left }}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: [0, 0.9, 0.9, 0.9],
            y: [0, -18, 0, -10, 0],
            x: [0, 8, -6, 0],
            rotate: [0, 8, -6, 0]
          }}
          transition={{
            opacity: { duration: 1.2, delay },
            y: { duration: 6 + (index % 3), repeat: Infinity, ease: 'easeInOut', delay },
            x: { duration: 7 + (index % 4), repeat: Infinity, ease: 'easeInOut', delay },
            rotate: { duration: 8 + (index % 3), repeat: Infinity, ease: 'easeInOut', delay }
          }}
        >
          <Icon size={size} strokeWidth={1.8} />
        </motion.div>
      ))}

      {/* Sparkle dots */}
      {Array.from({ length: 18 }).map((_, i) => {
        const top = `${(i * 53) % 100}%`;
        const left = `${(i * 37) % 100}%`;
        const delay = (i % 6) * 0.4;
        return (
          <motion.span
            key={`dot-${i}`}
            className="absolute h-1.5 w-1.5 rounded-full bg-blue-400/70 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
            style={{ top, left }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
          />
        );
      })}

      {/* Top & bottom soft white fades for legibility */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/80 to-transparent" />
    </div>
  );
};

/**
 * AuthShowcasePanel
 * Premium white + blue showcase panel shown beside the form on large screens.
 */
export const AuthShowcasePanel = ({ eyebrow = 'Syncrova', title, subtitle, highlights = [], children, AppLogoMark }) => (
  <section className="relative hidden min-h-[42rem] overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/60 to-sky-50/80 p-10 text-slate-900 shadow-[0_30px_80px_-30px_rgba(59,130,246,0.45)] lg:block">
    {/* Decorative aurora */}
    <motion.div
      aria-hidden
      className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-400/50 to-sky-300/40 blur-3xl"
      animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.95, 0.7] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      aria-hidden
      className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-300/40 to-blue-200/40 blur-3xl"
      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
      transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Grid wash */}
    <div aria-hidden className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

    {/* Floating mini-icons inside the panel */}
    <motion.div
      aria-hidden
      className="absolute top-10 right-12 text-blue-400/70"
      animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Sparkles size={26} />
    </motion.div>
    <motion.div
      aria-hidden
      className="absolute bottom-24 right-16 text-sky-400/70"
      animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Star size={22} />
    </motion.div>

    <div className="relative flex h-full flex-col justify-between">
      <div>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-black text-blue-700 shadow-sm backdrop-blur"
        >
          <ShieldCheck size={16} className="text-blue-600" />
          Verified campus access
        </motion.span>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12 max-w-lg"
        >
          <p className="mb-3 inline-flex rounded-full bg-blue-600/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
            {eyebrow}
          </p>
          <h1 className="bg-gradient-to-br from-slate-900 via-blue-800 to-sky-600 bg-clip-text text-[2.7rem] font-black leading-[1.05] text-transparent">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-md text-[15px] font-semibold leading-7 text-slate-600">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="grid gap-3"
      >
        <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-xl shadow-blue-200/40 backdrop-blur">
          <div className="flex items-center gap-3">
            {AppLogoMark && <AppLogoMark size="md" />}
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-blue-600">Account status</p>
              <p className="text-2xl font-black text-slate-900">Ready for campus</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {highlights.map(([item, Icon, color]) => (
              <span
                key={item}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-3 py-2 text-center text-xs font-black text-slate-700 shadow-sm"
              >
                <Icon size={14} className={color} />
                {item}
              </span>
            ))}
          </div>
        </div>
        {children}
      </motion.div>
    </div>
  </section>
);

export default AuthBackground;
