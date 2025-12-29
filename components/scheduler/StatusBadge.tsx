import React from 'react';
import { RefreshCw, CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import { ScheduledPost } from '../../types';

interface StatusBadgeProps {
  status: ScheduledPost['status'];
  id: string;
  processingId: string | null;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, id, processingId }) => {
  if (id === processingId) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <RefreshCw size={12} className="animate-spin" /> Publishing...
      </span>
    );
  }

  switch (status) {
    case 'published':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 size={12} /> Published
        </span>
      );
    case 'due':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
          <Clock size={12} /> Due Now
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle size={12} /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <Calendar size={12} /> Pending
        </span>
      );
  }
};
