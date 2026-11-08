import { ImageJob, QueueStats, UpscaleFactor } from '../types.js';

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'MB'}`;
}

export function calculateTargetDimensions(
  width: number,
  height: number,
  scale: UpscaleFactor
): { width: number; height: number } {
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

export function calculateEta(
  queuedCount: number,
  avgTimeMs: number,
  concurrency: number = 2
): number {
  if (queuedCount <= 0) return 0;
  const safeConcurrency = Math.max(1, concurrency);
  // Default to 1.8 seconds per image if no history yet
  const effectiveTimeMs = avgTimeMs > 0 ? avgTimeMs : 1800;
  const batches = Math.ceil(queuedCount / safeConcurrency);
  const totalMs = batches * effectiveTimeMs;
  return Math.ceil(totalMs / 1000);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function sanitizeFilename(originalName: string, scale: number, targetExt: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalName.substring(0, lastDot) : originalName;
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = targetExt.startsWith('.') ? targetExt.substring(1) : targetExt;
  return `${safeBase}_${scale}x_upscaled.${ext.toLowerCase()}`;
}

export function computeQueueStats(jobs: ImageJob[], concurrency: number = 2): QueueStats {
  const total = jobs.length;
  let queued = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;
  let totalOriginalBytes = 0;
  let totalUpscaledBytes = 0;
  let totalProcessingTimeMs = 0;
  let currentProcessingName: string | undefined;

  for (const job of jobs) {
    totalOriginalBytes += job.originalSize || 0;
    if (job.status === 'queued') {
      queued++;
    } else if (job.status === 'processing') {
      processing++;
      if (!currentProcessingName) {
        currentProcessingName = job.originalName;
      }
    } else if (job.status === 'completed') {
      completed++;
      totalUpscaledBytes += job.upscaledSize || 0;
      if (job.processingTimeMs) {
        totalProcessingTimeMs += job.processingTimeMs;
      }
    } else if (job.status === 'failed') {
      failed++;
    }
  }

  const avgProcessingTimeMs = completed > 0 ? Math.round(totalProcessingTimeMs / completed) : 1800;
  const remainingWork = queued + processing;
  const estimatedRemainingTimeSec = calculateEta(remainingWork, avgProcessingTimeMs, concurrency);
  
  // Calculate throughput per minute
  const throughputPerMinute = avgProcessingTimeMs > 0 
    ? Math.round((60000 / avgProcessingTimeMs) * Math.max(1, concurrency)) 
    : 0;

  return {
    total,
    queued,
    processing,
    completed,
    failed,
    totalOriginalBytes,
    totalUpscaledBytes,
    avgProcessingTimeMs,
    currentProcessingName,
    estimatedRemainingTimeSec,
    throughputPerMinute
  };
}

export function generateMetadataCsv(jobs: ImageJob[]): string {
  const headers = [
    'Job ID',
    'Original File Name',
    'Original Width (px)',
    'Original Height (px)',
    'Original Size (bytes)',
    'Original Size Human',
    'Status',
    'Scale Factor',
    'Upscaled Width (px)',
    'Upscaled Height (px)',
    'Upscaled Size (bytes)',
    'Upscaled Size Human',
    'Target DPI',
    'Model Applied',
    'Processing Time (ms)',
    'Created At',
    'Completed At',
    'Error'
  ];

  const rows = jobs.map(j => [
    j.id,
    `"${(j.originalName || '').replace(/"/g, '""')}"`,
    j.originalWidth || '',
    j.originalHeight || '',
    j.originalSize || 0,
    `"${formatBytes(j.originalSize)}"`,
    j.status,
    j.scaleApplied ? `${j.scaleApplied}x` : '',
    j.upscaledWidth || '',
    j.upscaledHeight || '',
    j.upscaledSize || '',
    j.upscaledSize ? `"${formatBytes(j.upscaledSize)}"` : '',
    j.dpiApplied || '',
    j.modelApplied || '',
    j.processingTimeMs || '',
    j.createdAt ? new Date(j.createdAt).toISOString() : '',
    j.completedAt ? new Date(j.completedAt).toISOString() : '',
    `"${(j.error || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}
