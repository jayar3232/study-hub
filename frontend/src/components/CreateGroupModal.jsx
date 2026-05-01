import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Sparkles, ArrowRight } from 'lucide-react';

export default function CreateGroupModal({ isOpen, onClose, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [focused, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGroupName('');
      setGroupDesc('');
      setFocused(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || submitting) return;

    setSubmitting(true);
    try {
      const created = await onCreate(groupName, groupDesc);
      if (created !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
          />
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Gradient top bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-indigo-500"></div>

              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-indigo-600">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Workspace</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Group Name Field with floating label effect */}
                <div className="relative">
                  <input
                    type="text"
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    className={`w-full px-4 pt-6 pb-2 rounded-xl border-2 transition-all bg-transparent text-gray-900 dark:text-white focus:outline-none peer ${
                      focused === 'name' || groupName
                        ? 'border-pink-500 dark:border-pink-400'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder=" "
                    required
                  />
                  <label
                    htmlFor="groupName"
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      focused === 'name' || groupName
                        ? 'text-xs text-pink-500 -translate-y-3'
                        : 'text-gray-500 dark:text-gray-400 translate-y-4'
                    }`}
                  >
                    Workspace name
                  </label>
                </div>

                {/* Description Field */}
                <div className="relative">
                  <textarea
                    id="groupDesc"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    onFocus={() => setFocused('desc')}
                    onBlur={() => setFocused(null)}
                    rows="3"
                    className={`w-full px-4 pt-6 pb-2 rounded-xl border-2 transition-all bg-transparent text-gray-900 dark:text-white focus:outline-none resize-none peer ${
                      focused === 'desc' || groupDesc
                        ? 'border-pink-500 dark:border-pink-400'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="groupDesc"
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      focused === 'desc' || groupDesc
                        ? 'text-xs text-pink-500 -translate-y-3'
                        : 'text-gray-500 dark:text-gray-400 translate-y-4'
                    }`}
                  >
                    Description (optional)
                  </label>
                </div>

                {/* Live Preview Card */}
                {(groupName || groupDesc) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-pink-500" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Preview
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {groupName || 'Workspace name preview'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {groupDesc || 'Description preview - this is how your workspace card will look.'}
                    </p>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs text-gray-400 font-mono">ACCESS CODE</div>
                      <div className="flex items-center gap-1 text-pink-500 text-sm font-medium">
                        Enter <ArrowRight size={14} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-5 py-2 rounded-xl font-medium bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Creating...' : 'Create Workspace'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
