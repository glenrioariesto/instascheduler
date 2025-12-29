import React from 'react';
import { Image as ImageIcon, Send, Trash2 } from 'lucide-react';
import { ScheduledPost } from '../../types';
import { StatusBadge } from './StatusBadge';

interface TableViewProps {
  posts: ScheduledPost[];
  processingId: string | null;
  onPostNow: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TableView: React.FC<TableViewProps> = ({ posts, processingId, onPostNow, onDelete }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Scheduled Time</th>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Caption Preview</th>
              <th className="px-6 py-4">Media</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No scheduled posts found in the connected sheet.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <StatusBadge status={post.status} id={post.id} processingId={processingId} />
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {new Date(post.scheduledTime).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {post.id}
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                    {post.caption}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-500">
                      <ImageIcon size={16} />
                      <span>{post.mediaItems.length}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {post.status !== 'published' && (
                        <button
                          onClick={() => onPostNow(post.id)}
                          disabled={!!processingId}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium disabled:opacity-50"
                          title="Post immediately"
                        >
                          <Send size={14} />
                          Post Now
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(post.id)}
                        disabled={!!processingId}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete post"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
