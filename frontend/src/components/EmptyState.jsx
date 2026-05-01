import React from 'react';
import { Users, MessageCircle, FileText } from 'lucide-react';

export default function EmptyState({ type, action }) {
  const config = {
    groups: { icon: Users, title: 'No workspaces yet', message: 'Create a new workspace or join using a code.', buttonText: 'Create Workspace', buttonAction: action },
    messages: { icon: MessageCircle, title: 'No messages yet', message: 'Start a conversation by clicking +', buttonText: 'Start Chat', buttonAction: action },
    posts: { icon: FileText, title: 'No announcements yet', message: 'Share the first workspace update.', buttonText: 'Create Announcement', buttonAction: action },
  };
  const { icon: Icon, title, message, buttonText, buttonAction } = config[type] || config.groups;
  return (
    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <Icon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mt-1">{message}</p>
      {buttonAction && (
        <button onClick={buttonAction} className="mt-4 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition">
          {buttonText}
        </button>
      )}
    </div>
  );
}
