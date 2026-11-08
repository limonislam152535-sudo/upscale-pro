export type UpscaleFactor = 2 | 4 | 8;

export type ModelMode = 
  | 'photo-ultra' 
  | 'anime-art' 
  | 'digital-graphics' 
  | 'balanced-universal';

export type OutputFormat = 'same' | 'jpeg' | 'png' | 'webp';

export type DpiPreset = 72 | 150 | 300 | 600 | 1200;
export type DpiOption = DpiPreset | number;

export interface UpscaleSettings {
  scale: UpscaleFactor;
  model: ModelMode;
  format: OutputFormat;
  quality: number; // 70 to 100
  dpi: number; // 1 to 1200 DPI
  customDpi?: number;
  isCustomDpi?: boolean;
  concurrency: number; // 1 to 4
  maxFileSizeMb: number; // 25, 50, 100
}

export type JobStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface ImageJob {
  id: string;
  originalName: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  originalFormat: string;
  status: JobStatus;
  progress: number; // 0 - 100
  error?: string;
  upscaledWidth?: number;
  upscaledHeight?: number;
  upscaledSize?: number;
  upscaledFormat?: string;
  processingTimeMs?: number;
  createdAt: number;
  completedAt?: number;
  scaleApplied?: UpscaleFactor;
  modelApplied?: ModelMode;
  dpiApplied?: DpiOption;
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  totalOriginalBytes: number;
  totalUpscaledBytes: number;
  avgProcessingTimeMs: number;
  currentProcessingName?: string;
  estimatedRemainingTimeSec: number;
  throughputPerMinute: number;
}

export interface ServerTelemetry {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  activeWorkers: number;
  maxWorkers: number;
  uptimeSeconds: number;
  engine: string;
}
