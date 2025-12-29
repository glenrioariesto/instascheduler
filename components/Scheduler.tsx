import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { ScheduledPost } from '../types';
import { fetchSheetData, updatePostStatus, deletePostFromSheet } from '../services/sheetService';
import { publishCarouselPost } from '../services/instagramService';
import { STORAGE_KEYS } from '../constants';
import { useAppStore } from '../store/useAppStore';

// Sub-components
import { SchedulerHeader } from './scheduler/SchedulerHeader';
import { TableView } from './scheduler/TableView';
import { CalendarView } from './scheduler/CalendarView';

export const Scheduler: React.FC = () => {
  const { settings, addLog } = useAppStore();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load published IDs from local storage
  const getPublishedIds = (): string[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.PUBLISHED_IDS);
    return stored ? JSON.parse(stored) : [];
  };

  const markAsPublished = (id: string) => {
    const ids = getPublishedIds();
    if (!ids.includes(id)) {
      const newIds = [...ids, id];
      localStorage.setItem(STORAGE_KEYS.PUBLISHED_IDS, JSON.stringify(newIds));
    }
  };

  const loadSchedule = async (manual = false) => {
    const isGoogleConnected = settings.googleAccessToken && settings.googleTokenExpiresAt && Date.now() < settings.googleTokenExpiresAt;

    if (!settings.spreadsheetId || !isGoogleConnected) {
      if (manual) alert("Please configure Google Sheets settings first (Spreadsheet ID + Auth).");
      return;
    }

    setLoading(true);
    try {
      const rawPosts = await fetchSheetData(settings);
      const now = new Date();

      const processedPosts = rawPosts.map(post => {
        const scheduledTime = new Date(post.scheduledTime);
        let status = post.status; // Use status from sheet

        // If sheet says pending/failed, check if it's actually 'due' now
        // This allows manual reset in the spreadsheet to work
        if (status !== 'published') {
          if (scheduledTime <= now) {
            status = 'due';
          }
        }

        return { ...post, status };
      });

      setPosts(processedPosts);
      setLastCheck(Date.now());

      if (manual) {
        addLog({ level: 'info', message: `Fetched ${processedPosts.length} rows from Google Sheet` });
      }

      return processedPosts;
    } catch (error: any) {
      console.error(error);
      addLog({ level: 'error', message: 'Failed to fetch schedule', details: error.message });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const processDuePosts = async (currentPosts: ScheduledPost[]) => {
    if (processingId) return;

    const duePost = currentPosts.find(p => p.status === 'due');

    if (duePost) {
      setProcessingId(duePost.id);
      addLog({ level: 'info', message: `Starting auto-publish for ID: ${duePost.id}` });

      try {
        await publishCarouselPost(
          settings.accountId,
          settings.accessToken,
          duePost.caption,
          duePost.mediaItems,
          (status) => console.log(`[${duePost.id}] ${status}`)
        );

        markAsPublished(duePost.id);
        addLog({ level: 'success', message: `Auto-published ID: ${duePost.id}` });

        if (duePost.sheetRowIndex) {
          try {
            await updatePostStatus(settings, duePost.sheetRowIndex, 'published');
            addLog({ level: 'info', message: `Synced 'published' status to Sheet for ID: ${duePost.id}` });
          } catch (syncError: any) {
            addLog({ level: 'error', message: `Failed to sync status to Sheet for ID: ${duePost.id}`, details: syncError.message });
          }
        }

        setPosts(prev => prev.map(p => p.id === duePost.id ? { ...p, status: 'published' } : p));

      } catch (error: any) {
        addLog({ level: 'error', message: `Failed to auto-publish ID: ${duePost.id}`, details: error.message });
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handlePostNow = async (id: string) => {
    if (processingId) return;
    const post = posts.find(p => p.id === id);
    if (!post) return;

    setProcessingId(id);
    addLog({ level: 'info', message: `Manual publish started for ID: ${id}` });

    try {
      await publishCarouselPost(
        settings.accountId,
        settings.accessToken,
        post.caption,
        post.mediaItems,
        (status) => console.log(`[${id}] ${status}`)
      );

      markAsPublished(id);
      addLog({ level: 'success', message: `Published successfully: ${id}` });

      if (post.sheetRowIndex) {
        try {
          await updatePostStatus(settings, post.sheetRowIndex, 'published');
          addLog({ level: 'info', message: `Synced 'published' status to Sheet for ID: ${id}` });
        } catch (syncError: any) {
          addLog({ level: 'error', message: `Failed to sync status to Sheet for ID: ${id}`, details: syncError.message });
        }
      }

      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));

    } catch (error: any) {
      addLog({ level: 'error', message: `Failed to publish ID: ${id}`, details: error.message });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'failed' } : p));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePost = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;

    if (!window.confirm(`Are you sure you want to delete this post? This will also remove it from the Google Sheet.`)) {
      return;
    }

    setProcessingId(id);
    addLog({ level: 'info', message: `Deleting post ID: ${id}` });

    try {
      if (post.sheetRowIndex) {
        await deletePostFromSheet(settings, post.sheetRowIndex);
        addLog({ level: 'success', message: `Deleted post from Sheet: ${id}` });
      }

      // Update local state
      setPosts(prev => prev.filter(p => p.id !== id));
      addLog({ level: 'success', message: `Post removed from schedule: ${id}` });

    } catch (error: any) {
      addLog({ level: 'error', message: `Failed to delete post ID: ${id}`, details: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    loadSchedule();
  }, [settings.spreadsheetId, settings.googleAccessToken]);

  // The Automation Loop
  useEffect(() => {
    if (isRunning) {
      const runCycle = async () => {
        const currentPosts = await loadSchedule();
        if (currentPosts) {
          await processDuePosts(currentPosts);
        }
      };

      runCycle();
      timerRef.current = setInterval(runCycle, 60000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, settings]);

  return (
    <div className="space-y-6">
      <SchedulerHeader
        isRunning={isRunning}
        onToggleRunning={() => setIsRunning(!isRunning)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lastCheck={lastCheck}
        loading={loading}
        onRefresh={() => loadSchedule(true)}
      />

      {(!settings.spreadsheetId || !settings.googleAccessToken) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex gap-3">
          <AlertCircle size={20} />
          <div>
            <p className="font-bold">Database not connected</p>
            <p className="text-sm">Please go to Settings and add your Google Sheets details (Sheet ID + Client ID or API Key).</p>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <TableView
          posts={posts}
          processingId={processingId}
          onPostNow={handlePostNow}
          onDelete={handleDeletePost}
        />
      ) : (
        <CalendarView
          posts={posts}
          processingId={processingId}
          onPostNow={handlePostNow}
          onDelete={handleDeletePost}
        />
      )}
    </div>
  );
};