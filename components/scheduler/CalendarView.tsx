import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Send, Trash2 } from 'lucide-react';
import { ScheduledPost } from '../../types';
import { StatusBadge } from './StatusBadge';

interface CalendarViewProps {
  posts: ScheduledPost[];
  processingId: string | null;
  onPostNow: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ posts, processingId, onPostNow, onDelete }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const calendarDays = [];
  // Padding for first day
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= days; i++) {
    calendarDays.push(i);
  }

  const getPostsForDay = (day: number) => {
    return posts.filter(post => {
      const postDate = new Date(post.scheduledTime);
      return postDate.getDate() === day && postDate.getMonth() === month && postDate.getFullYear() === year;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[120px]">
        {calendarDays.map((day, idx) => {
          const dayPosts = day ? getPostsForDay(day) : [];
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

          return (
            <div
              key={idx}
              className={`border-r border-b border-slate-100 p-2 transition-colors ${day ? 'hover:bg-slate-50/50' : 'bg-slate-50/20'}`}
            >
              {day && (
                <div className="flex flex-col h-full">
                  <span className={`text-sm font-medium mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                    {day}
                  </span>
                  <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {dayPosts.map(post => (
                      <div
                        key={post.id}
                        className={`group relative p-1.5 rounded border text-[10px] leading-tight transition-all ${post.status === 'published'
                          ? 'bg-green-50 border-green-100 text-green-700'
                          : post.status === 'due'
                            ? 'bg-amber-50 border-amber-100 text-amber-700'
                            : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate">{new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            {post.status !== 'published' && (
                              <button
                                onClick={() => onPostNow(post.id)}
                                disabled={!!processingId}
                                className="p-0.5 bg-white rounded shadow-sm text-indigo-600 hover:text-indigo-800"
                                title="Post Now"
                              >
                                <Send size={10} />
                              </button>
                            )}
                            <button
                              onClick={() => onDelete(post.id)}
                              disabled={!!processingId}
                              className="p-0.5 bg-white rounded shadow-sm text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        <p className="truncate opacity-80">{post.caption}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
