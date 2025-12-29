import React, { useState } from 'react';
import { Plus, X, Image as ImageIcon, Video, Save, Loader2, GripVertical, Calendar, FileText, Type, MessageSquare, UploadCloud } from 'lucide-react';
import { MediaItem } from '../types';
import { addToSchedule } from '../services/sheetService';
import { uploadFileToImageKit } from '../services/imageKitService';
import { compressImage } from '../utils/imageUtils';
import { useAppStore } from '../store/useAppStore';

export const PostForm: React.FC = () => {
  const { settings, addLog, showAlert } = useAppStore();
  const [date, setDate] = useState('');
  const [theme, setTheme] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [script, setScript] = useState('');
  const [cta, setCta] = useState('');

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([
    { id: crypto.randomUUID(), type: 'IMAGE', url: '' }
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  const handleAddMedia = () => {
    setMediaItems([...mediaItems, { id: crypto.randomUUID(), type: 'IMAGE', url: '' }]);
  };

  const handleRemoveMedia = (id: string) => {
    if (mediaItems.length <= 1) {
      showAlert("Minimum Media", "Must have at least 1 media item.", "info");
      return;
    }
    setMediaItems(mediaItems.filter(item => item.id !== id));
  };

  const updateMediaItem = (id: string, updates: Partial<MediaItem>) => {
    setMediaItems(mediaItems.map(item => {
      if (item.id === id) {
        const newItem = { ...item, ...updates };
        if (updates.url) {
          newItem.url = updates.url;
        }
        return newItem;
      }
      return item;
    }));
  };

  const handleFileUpload = async (id: string, file: File) => {
    if (!settings.imageKitPublicKey || !settings.imageKitPrivateKey || !settings.imageKitUrlEndpoint) {
      showAlert("Configuration Missing", "Please configure ImageKit settings in the Settings tab first.", "error");
      return;
    }

    // Show loading state for this item
    setStatusMessage(`Uploading ${file.name} to ImageKit...`);
    setIsSaving(true); // Block interactions

    try {
      let fileToUpload = file;
      const isVideo = file.type.startsWith('video/');

      // Compress if it's an image
      if (!isVideo) {
        setStatusMessage(`Compressing ${file.name}...`);
        try {
          fileToUpload = await compressImage(file);
          console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(2)}KB -> ${(fileToUpload.size / 1024).toFixed(2)}KB`);
        } catch (err) {
          console.warn("Compression failed, uploading original:", err);
        }
      }

      setStatusMessage(`Uploading ${file.name} to ImageKit...`);
      const publicLink = await uploadFileToImageKit(
        fileToUpload,
        settings.imageKitPublicKey,
        settings.imageKitPrivateKey,
        settings.imageKitUrlEndpoint
      );

      // Determine type based on file
      const type = isVideo ? 'VIDEO' : 'IMAGE';

      // Update the item with the new link and type
      updateMediaItem(id, { url: publicLink, type });

      setStatusMessage('Upload complete!');
      setTimeout(() => setStatusMessage(''), 2000);
    } catch (error: any) {
      showAlert("Upload Failed", `Upload failed: ${error.message}`, "error");
      setStatusMessage('');
    } finally {
      setIsSaving(false);
    }
  };

  const activeProfile = settings.profiles?.find(p => p.id === settings.activeProfileId);

  const handleSave = async () => {
    if (!activeProfile) {
      showAlert("No Active Profile", "Please select or create an Instagram profile in Settings first.", "error");
      return;
    }

    if (!date) {
      showAlert("Missing Date", "Please select a date.", "error");
      return;
    }

    if (mediaItems.some(m => !m.url)) {
      showAlert("Missing Media", "Please fill in all media URLs.", "error");
      return;
    }

    setIsSaving(true);
    setStatusMessage('Saving to Schedule...');
    setStatusType('');

    try {
      const postData = {
        date,
        theme,
        title,
        caption,
        script,
        cta,
        mediaItems
      };

      await addToSchedule(settings, postData, activeProfile.sheetTabName);

      setStatusMessage('Saved successfully!');
      setStatusType('success');
      addLog({ level: 'success', message: `Added new post to ${activeProfile.name} schedule`, details: `Date: ${date}, Title: ${title}`, profileId: activeProfile.id });

      // Reset form
      setTimeout(() => {
        setDate('');
        setTheme('');
        setTitle('');
        setCaption('');
        setScript('');
        setCta('');
        setMediaItems([{ id: crypto.randomUUID(), type: 'IMAGE', url: '' }]);
        setStatusMessage('');
        setStatusType('');
        setIsSaving(false);
      }, 2000);

    } catch (error: any) {
      console.error(error);
      setStatusMessage(`Failed to save: ${error.message}`);
      setStatusType('error');
      addLog({ level: 'error', message: 'Failed to save to schedule', details: error.message, profileId: activeProfile.id });
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-600" />
              Add to Schedule
            </h2>
          </div>

          <div className="space-y-5">
            {/* Date & Theme */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content Theme</label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="e.g. Educational, Promo"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Title / Hook */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title / Hook</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Type size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="Catchy headline..."
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                placeholder="Write your caption here..."
                disabled={isSaving}
              />
            </div>

            {/* Script & CTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Script (Optional)</label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                  placeholder="Key points for video/carousel..."
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Call to Action (CTA)</label>
                <textarea
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                  placeholder="e.g. Click link in bio!"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Media Items */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Media Assets (Min 1)</label>
              <div className="space-y-3">
                {mediaItems.map((item, index) => (
                  <div key={item.id} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200 group">
                    <div className="mt-2 text-slate-400 cursor-grab active:cursor-grabbing">
                      <GripVertical size={16} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={item.type}
                          onChange={(e) => updateMediaItem(item.id, { type: e.target.value as 'IMAGE' | 'VIDEO' })}
                          className="bg-white border border-slate-300 text-sm rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                          disabled={isSaving}
                        >
                          <option value="IMAGE">Image</option>
                          <option value="VIDEO">Video</option>
                        </select>
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => updateMediaItem(item.id, { url: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Paste media URL..."
                          disabled={isSaving}
                        />

                        {/* Upload Button */}
                        <label className={`flex items-center justify-center px-3 py-1.5 bg-slate-100 border border-slate-300 rounded cursor-pointer hover:bg-slate-200 transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <UploadCloud size={16} className="text-slate-600" />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/*"
                            disabled={isSaving}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(item.id, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {item.type === 'IMAGE' ? <ImageIcon size={12} /> : <Video size={12} />}
                        <span>Slide {index + 1}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      disabled={mediaItems.length <= 1 || isSaving}
                      title="Remove Slide"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddMedia}
                disabled={mediaItems.length >= 10 || isSaving}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
              >
                <Plus size={16} /> Add Media
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end items-center gap-4">
            {statusMessage && (
              <div className={`text-sm font-medium ${statusType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {statusMessage}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || !date}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all shadow-sm ${isSaving
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'
                }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save to Schedule
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Preview / Helper */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
            <FileText size={18} />
            Sheet Preview
          </h3>
          <p className="text-sm text-indigo-700 mb-4">
            This data will be appended to your <b>{activeProfile?.sheetTabName || 'Schedules'}</b> tab.
          </p>

          <div className="space-y-3 text-sm">
            <div className="bg-white p-3 rounded border border-indigo-100">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Date</div>
              <div className="text-slate-800 font-mono">{date || '-'}</div>
            </div>
            <div className="bg-white p-3 rounded border border-indigo-100">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Title</div>
              <div className="text-slate-800 line-clamp-2">{title || '-'}</div>
            </div>
            <div className="bg-white p-3 rounded border border-indigo-100">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Caption</div>
              <div className="text-slate-800 line-clamp-3">{caption || '-'}</div>
            </div>
            <div className="bg-white p-3 rounded border border-indigo-100">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Media Count</div>
              <div className="text-slate-800">{mediaItems.length} Items</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};