import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { ScheduledPost } from '../types';
import { fetchSheetData, updatePostStatus, deletePostFromSheet, getSchedulerStatus, setSchedulerStatus } from '../services/sheetService';
import { publishCarouselPost } from '../services/instagramService';
import { STORAGE_KEYS } from '../constants';
import { useAppStore } from '../store/useAppStore';

// Sub-components
import { SchedulerHeader } from './scheduler/SchedulerHeader';
import { TableView } from './scheduler/TableView';
import { CalendarView } from './scheduler/CalendarView';

export const Scheduler: React.FC = () => {
  const { settings, addLog, showAlert, showConfirm } = useAppStore();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [schedulerStatus, setSchedulerStatusState] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');



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

  const activeProfile = settings.profiles?.find(p => p.id === settings.activeProfileId);

  const loadSchedule = async (manual = false) => {
    if (!settings.spreadsheetId) {
      if (manual) showAlert("Database Not Connected", "Please configure Google Sheets Spreadsheet ID first.", "error");
      return;
    }

    if (!activeProfile) {
      if (manual) showAlert("No Active Profile", "Please select or create an Instagram profile in Settings.", "error");
      return;
    }

    setLoading(true);
    setPosts([]); // Clear stale posts immediately
    try {
      const [rawPosts, status] = await Promise.all([
        fetchSheetData(settings, activeProfile.sheetTabName),
        getSchedulerStatus(settings)
      ]);
      setSchedulerStatusState(status);
      const now = new Date();

      const processedPosts = rawPosts.map(post => {
        const scheduledTime = new Date(post.scheduledTime);
        let status = post.status; // Use status from sheet

        // If sheet says pending/failed, check if it's actually 'due' now
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
        addLog({ level: 'info', message: `Fetched ${processedPosts.length} rows for ${activeProfile.name}` });
      }

      return processedPosts;
    } catch (error: any) {
      console.error(error);
      addLog({ level: 'error', message: `Failed to fetch schedule for ${activeProfile?.name}`, details: error.message });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (loading) return;
    const newStatus = schedulerStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    // Optimistic update
    setSchedulerStatusState(newStatus);

    try {
      await setSchedulerStatus(settings, newStatus);
      addLog({ level: 'info', message: `Scheduler status changed to ${newStatus}` });
    } catch (error: any) {
      // Revert on error
      setSchedulerStatusState(schedulerStatus);
      addLog({ level: 'error', message: `Failed to update scheduler status`, details: error.message });
      showAlert("Update Failed", "Failed to update scheduler status.", "error");
    }
  };

  const handleRunCron = async () => {
    if (loading || !activeProfile) return;

    setLoading(true);
    addLog({ level: 'info', message: `Triggering manual cron job...` });

    try {
      // We try to use the VITE_CRON_SECRET if available in the client environment
      const secret = import.meta.env.VITE_CRON_SECRET;
      const url = secret ? `/api/cron/post?key=${secret}` : '/api/cron/post';

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        addLog({ level: 'success', message: `Cron job executed successfully`, details: JSON.stringify(data) });
        showAlert("Cron Job Success", "The cron job has been executed.", "success");
        await loadSchedule(false); // Refresh data
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error(error);
      addLog({ level: 'error', message: `Cron job failed`, details: error.message });
      showAlert("Cron Job Failed", `Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePostNow = async (id: string) => {
    if (processingId || !activeProfile) return;
    const post = posts.find(p => p.id === id);
    if (!post) return;

    setProcessingId(id);
    addLog({ level: 'info', message: `[${activeProfile.name}] Manual publish started`, profileId: activeProfile.id });

    try {
      await publishCarouselPost(
        activeProfile.accountId,
        activeProfile.accessToken,
        post.caption,
        post.mediaItems,
        (status) => console.log(`[${activeProfile.name}][${id}] ${status}`)
      );

      markAsPublished(id);
      addLog({ level: 'success', message: `[${activeProfile.name}] Published successfully`, profileId: activeProfile.id });

      if (post.sheetRowIndex) {
        try {
          await updatePostStatus(settings, post.sheetRowIndex, 'published', activeProfile.sheetTabName);
        } catch (syncError: any) {
          addLog({ level: 'error', message: `Failed to sync status to Sheet`, details: syncError.message, profileId: activeProfile.id });
        }
      }

      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));

    } catch (error: any) {
      addLog({ level: 'error', message: `Failed to publish`, details: error.message, profileId: activeProfile.id });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'failed' } : p));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!activeProfile) return;
    const post = posts.find(p => p.id === id);
    if (!post) return;

    showConfirm(
      "Delete Post",
      "Are you sure you want to delete this post? This will also remove it from the Google Sheet.",
      async () => {
        setProcessingId(id);
        try {
          if (post.sheetRowIndex) {
            await deletePostFromSheet(settings, post.sheetRowIndex, activeProfile.sheetTabName);
          }
          setPosts(prev => prev.filter(p => p.id !== id));
          addLog({ level: 'success', message: `Post removed from ${activeProfile.name} schedule` });
        } catch (error: any) {
          addLog({ level: 'error', message: `Failed to delete post`, details: error.message });
        } finally {
          setProcessingId(null);
        }
      },
      "Delete",
      "Cancel"
    );
  };

  useEffect(() => {
    loadSchedule();
  }, [settings.spreadsheetId, settings.activeProfileId]);



  return (
    <div className="space-y-6">
      <SchedulerHeader
        onRunCron={handleRunCron}
        schedulerStatus={schedulerStatus}
        onToggleStatus={handleToggleStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lastCheck={lastCheck}
        loading={loading}
        onRefresh={() => loadSchedule(true)}
      />

      {!settings.spreadsheetId && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex gap-3">
          <AlertCircle size={20} />
          <div>
            <p className="font-bold">Database not connected</p>
            <p className="text-sm">Please go to Settings and add your Google Sheets Spreadsheet ID.</p>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <TableView
          posts={posts}
          loading={loading}
          processingId={processingId}
          onPostNow={handlePostNow}
          onDelete={handleDeletePost}
        />
      ) : (
        <CalendarView
          posts={posts}
          loading={loading}
          processingId={processingId}
          onPostNow={handlePostNow}
          onDelete={handleDeletePost}
        />
      )}
    </div>
  );
};