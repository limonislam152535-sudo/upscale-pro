import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, 
  Download, 
  FileSpreadsheet, 
  Trash2, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  RotateCw,
  FolderArchive,
  Layers,
  ShieldCheck
} from 'lucide-react';

import { ImageJob, QueueStats, UpscaleSettings, ServerTelemetry } from './types.js';
import { computeQueueStats } from './utils/queueLogic.js';
import { Header } from './components/Header.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { QueueStatsBar } from './components/QueueStatsBar.js';
import { Dropzone } from './components/Dropzone.js';
import { ImageCard } from './components/ImageCard.js';
import { ComparisonModal } from './components/ComparisonModal.js';
import { ExportCodeModal } from './components/ExportCodeModal.js';

export default function App() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalOriginalBytes: 0,
    totalUpscaledBytes: 0,
    avgProcessingTimeMs: 1800,
    estimatedRemainingTimeSec: 0,
    throughputPerMinute: 32
  });

  const [settings, setSettings] = useState<UpscaleSettings>({
    scale: 4,
    model: 'photo-ultra',
    format: 'same',
    quality: 92,
    dpi: 300,
    concurrency: 2,
    maxFileSizeMb: 50
  });

  const [telemetry, setTelemetry] = useState<ServerTelemetry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'queued' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [comparingJob, setComparingJob] = useState<ImageJob | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch jobs & stats from server
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
      if (data.stats) {
        setStats(data.stats);
      }
      setIsProcessing(data.isProcessing || false);
    } catch (err) {
      console.warn('Failed to poll jobs:', err);
    }
  }, []);

  // Fetch telemetry
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/server-info');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Poll loop
  useEffect(() => {
    fetchJobs();
    fetchTelemetry();

    const interval = setInterval(() => {
      fetchJobs();
      fetchTelemetry();
    }, 1500);

    return () => clearInterval(interval);
  }, [fetchJobs, fetchTelemetry]);

  // Handle files upload
  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await res.json();
      showToast(`Uploaded ${data.count} image${data.count > 1 ? 's' : ''} to cloud queue.`);
      await fetchJobs();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Load sample demo images
  const handleLoadSamples = async () => {
    setIsUploading(true);
    try {
      const res = await fetch('/api/upload-sample', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create sample images');
      const data = await res.json();
      showToast(`Loaded ${data.count} high-detail test samples into queue.`);
      await fetchJobs();
    } catch (err: any) {
      alert(`Sample error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Start cloud queue processing
  const handleStartProcessing = async () => {
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          retryAllFailed: true
        })
      });

      if (!res.ok) throw new Error('Failed to start queue');
      setIsProcessing(true);
      showToast(`Cloud upscaling started with ${settings.concurrency} concurrent worker(s).`);
      await fetchJobs();
    } catch (err: any) {
      alert(`Error starting queue: ${err.message}`);
    }
  };

  // Retry single job
  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/process-single/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        showToast('Retrying image processing...');
        await fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Remove single job
  const handleRemoveJob = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      await fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  // Clear jobs
  const handleClearJobs = async (filter: 'completed' | 'all') => {
    try {
      await fetch('/api/jobs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter })
      });
      await fetchJobs();
      showToast(filter === 'completed' ? 'Cleared completed items.' : 'Cleared all items from queue.');
    } catch (err) {
      console.error(err);
    }
  };

  // Download single image
  const handleDownloadSingle = (job: ImageJob) => {
    window.location.href = `/api/download/${job.id}`;
  };

  // Download all completed as ZIP
  const handleDownloadZip = () => {
    if (stats.completed === 0) {
      alert('No completed images available to download yet.');
      return;
    }
    setIsDownloadingZip(true);
    window.location.href = '/api/download-zip';
    setTimeout(() => setIsDownloadingZip(false), 2000);
  };

  // Download metadata CSV
  const handleDownloadCsv = () => {
    if (jobs.length === 0) {
      alert('No images to export.');
      return;
    }
    window.location.href = '/api/download-csv';
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Status filter
      if (activeFilter !== 'all' && job.status !== activeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return job.originalName.toLowerCase().includes(query);
      }
      return true;
    });
  }, [jobs, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-white text-[#202438] flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#202438] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-[#635BFF]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        telemetry={telemetry}
        onOpenCodeModal={() => setIsCodeModalOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Zero Client Load Hero Banner */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#635BFF]/10 text-[#635BFF] text-xs font-bold mb-3 border border-[#635BFF]/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Cloud-Executed • Zero Laptop Strain
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#202438] tracking-tight">
              Enterprise Batch Super-Resolution
            </h2>
            <p className="mt-2 text-sm text-[#5B6275] leading-relaxed">
              Drop 150–200+ images and upscale up to 8X without warming up your laptop fan. 
              Our cloud engine handles Lanczos-3 reconstruction, Real-ESRGAN edge sharpening, and injects commercial 300+ DPI print metadata.
            </p>
          </div>

          <div className="absolute top-0 right-0 w-96 h-full opacity-10 pointer-events-none hidden lg:block bg-gradient-to-l from-[#635BFF] to-transparent" />
        </div>

        {/* Global Settings Panel */}
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          disabled={isProcessing}
        />

        {/* Dropzone for Bulk Uploads */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          onLoadSamples={handleLoadSamples}
          isUploading={isUploading}
          maxFileSizeMb={settings.maxFileSizeMb}
        />

        {/* Live Processing Queue Dashboard */}
        <QueueStatsBar
          stats={stats}
          isProcessing={isProcessing}
        />

        {/* Action Bar */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              disabled={isProcessing || stats.queued === 0}
              onClick={handleStartProcessing}
              className="px-5 py-2.5 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] text-white font-bold text-xs shadow-md shadow-[#635BFF]/20 flex items-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Processing Cloud Queue...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Upscaling ({stats.queued} Queued)</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={stats.completed === 0}
              onClick={handleDownloadZip}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#202438] font-bold text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-40"
              title="Stream all completed images into a single clean ZIP archive"
            >
              <FolderArchive className="w-4 h-4 text-[#635BFF]" />
              <span>Download ZIP ({stats.completed})</span>
            </button>

            <button
              type="button"
              disabled={jobs.length === 0}
              onClick={handleDownloadCsv}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#5B6275] font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Export complete metadata CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>CSV Report</span>
            </button>
          </div>

          {/* Right Filter & Search */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-[#5B6275] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#202438] focus:outline-hidden focus:ring-2 focus:ring-[#635BFF]"
              />
            </div>

            {stats.completed > 0 && (
              <button
                type="button"
                onClick={() => handleClearJobs('completed')}
                className="px-3 py-1.5 text-xs font-semibold text-[#5B6275] hover:text-[#202438] bg-white border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
              >
                Clear Finished
              </button>
            )}

            {jobs.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearJobs('all')}
                className="p-2 text-[#5B6275] hover:text-rose-600 bg-white border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
                title="Clear entire queue"
                aria-label="Clear all images"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {[
              { id: 'all', label: `All (${jobs.length})` },
              { id: 'queued', label: `In Queue (${stats.queued})` },
              { id: 'processing', label: `Processing (${stats.processing})` },
              { id: 'completed', label: `Completed (${stats.completed})` },
              { id: 'failed', label: `Failed (${stats.failed})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-[#635BFF] text-white shadow-xs'
                    : 'bg-[#F7F8FC] text-[#5B6275] hover:text-[#202438] hover:bg-[#EEF1F8] border border-[#E2E8F0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Image Grid Gallery */}
        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredJobs.map((job) => (
              <ImageCard
                key={job.id}
                job={job}
                onDownload={handleDownloadSingle}
                onCompare={setComparingJob}
                onRemove={handleRemoveJob}
                onRetry={handleRetryJob}
              />
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-3xl p-12 text-center text-[#5B6275]">
            <p className="text-sm font-semibold">No images match current filter "{activeFilter}".</p>
          </div>
        ) : (
          <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-3xl p-12 text-center">
            <Layers className="w-10 h-10 text-[#635BFF] mx-auto mb-3 opacity-60" />
            <h4 className="text-base font-bold text-[#202438]">No images in queue yet</h4>
            <p className="text-xs text-[#5B6275] mt-1 max-w-sm mx-auto">
              Drag and drop your images into the dropzone above or click "Load Test Sample Images" to immediately test cloud upscaling.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 mt-12 text-center text-xs text-[#5B6275]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Upscaler Pro • Light Theme Enforced • Zero Client Device Burden</span>
          <div className="flex items-center gap-4">
            <span>DPI EXIF Engine</span>
            <span>Streaming ZIP Archiver</span>
            <span>No Quotas / Continuous Queue</span>
          </div>
        </div>
      </footer>

      {/* Before / After Inspection Modal */}
      <ComparisonModal
        job={comparingJob}
        onClose={() => setComparingJob(null)}
        onDownload={handleDownloadSingle}
      />

      {/* Production Deliverables Code Modal */}
      <ExportCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
