import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingSpinner({ label = 'Loading StudentHub', fullScreen = false, compact = false }) {
  const rootHeight = fullScreen ? 'min-h-screen' : compact ? 'min-h-[160px]' : 'min-h-[320px]';
  const dotSize = compact ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <div className={`relative flex ${rootHeight} w-full items-center justify-center px-4 py-8`}>
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-black uppercase tracking-normal text-pink-500 dark:text-pink-300">StudentHub</p>
        <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white sm:text-2xl">{label}</h2>

        <div className="mx-auto mt-6 flex w-fit items-end gap-2">
          {[0, 1, 2, 3].map(item => (
            <motion.span
              key={item}
              animate={{ y: [0, -10, 0], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 0.9, delay: item * 0.1, repeat: Infinity, ease: 'easeInOut' }}
              className={`${dotSize} rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 shadow-sm shadow-pink-500/30`}
            />
          ))}
        </div>

        <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
          <motion.div
            animate={{ x: ['-100%', '120%'] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 via-pink-500 to-violet-500"
          />
        </div>
      </div>
    </div>
  );
}
