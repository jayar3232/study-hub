import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, CheckSquare, Upload, ArrowRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: 'Study Groups', desc: 'Create or join study groups with a unique code' },
    { icon: FileText, title: 'Announcements', desc: 'Share posts, like and comment with classmates' },
    { icon: CheckSquare, title: 'Task Manager', desc: 'Collaborative to-do lists for group projects' },
    { icon: Upload, title: 'File Sharing', desc: 'Upload and download notes, PDFs, images' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-700">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
            StudyHub
          </h1>
          <p className="text-xl text-indigo-200 mb-8">
            Collaborate smarter, not harder
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="bg-white text-indigo-700 px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
          >
            Get Started <ArrowRight size={20} />
          </motion.button>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -10 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white border border-white/20"
            >
              <feature.icon className="w-12 h-12 mb-4 text-blue-300" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-indigo-200">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-20"
        >
          <p className="text-indigo-200 mb-4">Already have an account?</p>
          <button
            onClick={() => navigate('/login')}
            className="border border-white text-white px-6 py-2 rounded-full hover:bg-white hover:text-indigo-700 transition"
          >
            Sign In
          </button>
        </motion.div>
      </div>
    </div>
  );
}