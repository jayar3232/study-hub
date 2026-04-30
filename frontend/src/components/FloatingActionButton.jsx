import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Users, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FloatingActionButton({ onGroupCreate, onNewChat }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: Users, label: 'Create Workspace', onClick: () => { onGroupCreate(); setOpen(false); } },
    { icon: MessageCircle, label: 'New Chat', onClick: () => { navigate('/messages'); setOpen(false); } },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-8">
      <AnimatePresence>
        {open && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2">
            {actions.map((action, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, y: 20 }}
                transition={{ delay: idx * 0.05 }}
                onClick={action.onClick}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition"
              >
                <action.icon size={18} />
                <span className="text-sm font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      >
        {open ? <X size={24} /> : <Plus size={24} />}
      </motion.button>
    </div>
  );
}
