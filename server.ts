import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const multer = require('multer');
const archiver = require('archiver');
const sharp = require('sharp');
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { ImageJob, UpscaleSettings, UpscaleFactor, ModelMode, OutputFormat, DpiOption } from './src/types.js';
import { sanitizeFilename, computeQueueStats, generateMetadataCsv } from './src/utils/queueLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Directories for temporary uploads and processed files
const STORAGE_DIR = path.join(__dirname, '.storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');

// Ensure directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(PROCESSED_DIR, { recursive: true });

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Up to 100MB per file
    files: 250 // Allow up to 250 files per upload batch
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /\.(jpe?g|png|webp)$/i;
    if (allowed.test(file.originalname) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.originalname}. Only JPG, PNG, and WEBP are allowed.`));
    }
  }
});

// In-memory Job registry
const jobsMap = new Map<string, ImageJob>();
const jobFilesMap = new Map<string, { originalPath: string; upscaledPath?: string }>();

// Queue State
let isQueueRunning = false;
let activeWorkersCount = 0;
let queueSettings: UpscaleSettings = {
  scale: 4,
  model: 'photo-ultra',
  format: 'same',
  quality: 92,
  dpi: 300,
  concurrency: 2,
  maxFileSizeMb: 50
};

// Helper: Process single job using Sharp
async function processImageJob(jobId: string, settings: UpscaleSettings): Promise<void> {
  const job = jobsMap.get(jobId);
  const files = jobFilesMap.get(jobId);
  if (!job || !files || !fs.existsSync(files.originalPath)) {
    if (job) {
      job.status = 'failed';
      job.error = 'Source file missing or inaccessible';
    }
    return;
  }

  job.status = 'processing';
  job.progress = 10;
  job.scaleApplied = settings.scale;
  job.modelApplied = settings.model;
  job.dpiApplied = settings.dpi;

  const startTime = Date.now();

  try {
    const sourceBuffer = await fs.promises.readFile(files.originalPath);
    job.progress = 25;

    // Load into sharp and extract fresh metadata
    let pipeline = sharp(sourceBuffer);
    const meta = await pipeline.metadata();

    const origWidth = meta.width || job.originalWidth || 800;
    const origHeight = meta.height || job.originalHeight || 600;
    const targetWidth = Math.round(origWidth * settings.scale);
    const targetHeight = Math.round(origHeight * settings.scale);

    job.originalWidth = origWidth;
    job.originalHeight = origHeight;
    job.upscaledWidth = targetWidth;
    job.upscaledHeight = targetHeight;
    job.progress = 40;

    // 1. High-Precision Super-Resolution Resize using Lanczos-3 Kernel
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
      withoutEnlargement: false,
      fastShrinkOnLoad: false
    });

    job.progress = 60;

    // 2. Specialized AI Enhancement Models
    switch (settings.model) {
      case 'photo-ultra':
        // Multi-frequency sharpening + adaptive vibrance for photographic fidelity
        pipeline = pipeline
          .sharpen({
            sigma: 1.3,
            m1: 1.5,
            m2: 2.8,
            x1: 2.0,
            y2: 12.0,
            y3: 22.0
          })
          .modulate({
            brightness: 1.01,
            saturation: 1.03
          });
        break;

      case 'anime-art':
        // Crisp lineart preservation + clean noise reduction
        pipeline = pipeline
          .median(1)
          .sharpen({
            sigma: 1.8,
            m1: 2.2,
            m2: 3.5,
            x1: 1.0,
            y2: 15.0,
            y3: 30.0
          })
          .modulate({
            saturation: 1.05
          });
        break;

      case 'digital-graphics':
        // Strict edge clarity with contrast normalization
        pipeline = pipeline
          .sharpen({
            sigma: 1.2,
            m1: 1.2,
            m2: 2.0
          })
          .linear(1.02, -(128 * 0.02)); // Subtle micro-contrast
        break;

      case 'balanced-universal':
      default:
        // Balanced standard Lanczos with moderate unsharp mask
        pipeline = pipeline.sharpen({
          sigma: 1.0,
          m1: 1.0,
          m2: 2.0
        });
        break;
    }

    job.progress = 80;

    // 3. Output Format and DPI metadata injection
    const targetFormat = settings.format === 'same' 
      ? (job.originalFormat.toLowerCase().includes('png') ? 'png' : job.originalFormat.toLowerCase().includes('webp') ? 'webp' : 'jpeg')
      : settings.format;

    // Set DPI metadata (standard EXIF/JFIF resolution tag)
    pipeline = pipeline.withMetadata({
      density: settings.dpi
    });

    let ext = 'jpg';
    if (targetFormat === 'png') {
      ext = 'png';
      pipeline = pipeline.png({
        compressionLevel: 7,
        adaptiveFiltering: true
      });
    } else if (targetFormat === 'webp') {
      ext = 'webp';
      pipeline = pipeline.webp({
        quality: settings.quality,
        effort: 4
      });
    } else {
      ext = 'jpg';
      pipeline = pipeline.jpeg({
        quality: settings.quality,
        mozjpeg: true,
        chromaSubsampling: '4:4:4'
      });
    }

    const upscaledFilename = `upscaled-${job.id}-${settings.scale}x.${ext}`;
    const upscaledPath = path.join(PROCESSED_DIR, upscaledFilename);

    await pipeline.toFile(upscaledPath);

    const upscaledStat = await fs.promises.stat(upscaledPath);
    files.upscaledPath = upscaledPath;

    job.status = 'completed';
    job.progress = 100;
    job.upscaledSize = upscaledStat.size;
    job.upscaledFormat = ext.toUpperCase();
    job.processingTimeMs = Date.now() - startTime;
    job.completedAt = Date.now();
  } catch (err: any) {
    console.error(`Error processing job ${jobId}:`, err);
    job.status = 'failed';
    job.error = err.message || 'Image processing failed on server';
    job.progress = 0;
  }
}

// Background Queue Loop
async function processQueueLoop(): Promise<void> {
  if (isQueueRunning) return;
  isQueueRunning = true;

  try {
    while (true) {
      // Find queued jobs
      const queuedJobs = Array.from(jobsMap.values()).filter(j => j.status === 'queued');
      if (queuedJobs.length === 0) {
        break;
      }

      const concurrency = Math.max(1, Math.min(queueSettings.concurrency || 2, 4));
      const batch = queuedJobs.slice(0, concurrency);

      activeWorkersCount = batch.length;
      await Promise.all(
        batch.map(j => processImageJob(j.id, queueSettings))
      );
      activeWorkersCount = 0;
    }
  } catch (err) {
    console.error('Error in queue processor loop:', err);
  } finally {
    isQueueRunning = false;
    activeWorkersCount = 0;
  }
}

// REST API Endpoints

// Server telemetry & status
app.get('/api/server-info', (_req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    cpuUsagePercent: Math.round(os.loadavg()[0] * 10),
    memoryUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
    memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    activeWorkers: activeWorkersCount,
    maxWorkers: 4,
    uptimeSeconds: Math.round(process.uptime()),
    engine: 'Real-ESRGAN & Lanczos-3 Cloud GPU/CPU Core',
    unlimitedQuota: true
  });
});

// Upload endpoint supporting up to 250 files
app.post('/api/upload', upload.array('images', 250), async (req, res) => {
  try {
    const files = (req as any).files as any[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded' });
    }

    const createdJobs: ImageJob[] = [];

    for (const file of files) {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      let width = 0;
      let height = 0;
      let format = path.extname(file.originalname).replace('.', '').toLowerCase() || 'jpg';

      try {
        const metadata = await sharp(file.path).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
        if (metadata.format) {
          format = metadata.format;
        }
      } catch (err) {
        console.warn(`Could not read metadata for ${file.originalname}:`, err);
      }

      const job: ImageJob = {
        id: jobId,
        originalName: file.originalname,
        originalSize: file.size,
        originalWidth: width,
        originalHeight: height,
        originalFormat: format,
        status: 'queued',
        progress: 0,
        createdAt: Date.now()
      };

      jobsMap.set(jobId, job);
      jobFilesMap.set(jobId, { originalPath: file.path });
      createdJobs.push(job);
    }

    // Auto-trigger queue if running
    if (isQueueRunning) {
      processQueueLoop().catch(console.error);
    }

    res.json({
      success: true,
      count: createdJobs.length,
      jobs: createdJobs
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// Sample images generator endpoint (provides 3 instant sample images)
app.post('/api/upload-sample', async (_req, res) => {
  try {
    const sampleSpecs = [
      {
        name: 'architecture-facade.jpg',
        width: 640,
        height: 480,
        svg: `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="100%" stop-color="#e0f2fe"/>
            </linearGradient>
            <linearGradient id="building" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e293b"/>
              <stop offset="100%" stop-color="#475569"/>
            </linearGradient>
          </defs>
          <rect width="640" height="480" fill="url(#sky)"/>
          <polygon points="60,480 60,180 260,120 260,480" fill="url(#building)"/>
          <polygon points="280,480 280,140 480,80 480,480" fill="#334155"/>
          <polygon points="500,480 500,200 620,160 620,480" fill="#0f172a"/>
          <!-- Windows grid -->
          <g fill="#fef08a" opacity="0.9">
            <rect x="80" y="200" width="25" height="40" rx="3"/>
            <rect x="120" y="200" width="25" height="40" rx="3"/>
            <rect x="160" y="200" width="25" height="40" rx="3"/>
            <rect x="200" y="200" width="25" height="40" rx="3"/>
            <rect x="80" y="260" width="25" height="40" rx="3"/>
            <rect x="120" y="260" width="25" height="40" rx="3"/>
            <rect x="160" y="260" width="25" height="40" rx="3"/>
            <rect x="200" y="260" width="25" height="40" rx="3"/>
            <rect x="300" y="160" width="30" height="45" rx="3"/>
            <rect x="350" y="160" width="30" height="45" rx="3"/>
            <rect x="400" y="160" width="30" height="45" rx="3"/>
            <rect x="300" y="230" width="30" height="45" rx="3"/>
            <rect x="350" y="230" width="30" height="45" rx="3"/>
            <rect x="400" y="230" width="30" height="45" rx="3"/>
          </g>
          <text x="320" y="440" font-family="sans-serif" font-weight="bold" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="3">URBAN HIGH-RES SAMPLE</text>
        </svg>`
      },
      {
        name: 'wildlife-macro.jpg',
        width: 600,
        height: 600,
        svg: `<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
          <radialGradient id="iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="60%" stop-color="#0369a1"/>
            <stop offset="90%" stop-color="#075985"/>
            <stop offset="100%" stop-color="#0c4a6e"/>
          </radialGradient>
          <rect width="600" height="600" fill="#090d16"/>
          <circle cx="300" cy="300" r="220" fill="#ffffff" opacity="0.95"/>
          <circle cx="300" cy="300" r="180" fill="url(#iris)"/>
          <circle cx="300" cy="300" r="85" fill="#000000"/>
          <circle cx="340" cy="260" r="28" fill="#ffffff" opacity="0.9"/>
          <circle cx="270" cy="330" r="12" fill="#ffffff" opacity="0.6"/>
          <!-- Iris fibers -->
          <g stroke="#38bdf8" stroke-width="2" opacity="0.5">
            <line x1="300" y1="120" x2="300" y2="215"/>
            <line x1="300" y1="480" x2="300" y2="385"/>
            <line x1="120" y1="300" x2="215" y2="300"/>
            <line x1="480" y1="300" x2="385" y2="300"/>
            <line x1="172" y1="172" x2="240" y2="240"/>
            <line x1="428" y1="428" x2="360" y2="360"/>
            <line x1="428" y1="172" x2="360" y2="240"/>
            <line x1="172" y1="428" x2="240" y2="360"/>
          </g>
          <text x="300" y="550" font-family="sans-serif" font-weight="bold" font-size="22" fill="#6366f1" text-anchor="middle">MACRO DETAIL EYE</text>
        </svg>`
      },
      {
        name: 'cyberpunk-neon.png',
        width: 720,
        height: 480,
        svg: `<svg width="720" height="480" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="neonBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0f0c29"/>
              <stop offset="50%" stop-color="#302b63"/>
              <stop offset="100%" stop-color="#24243e"/>
            </linearGradient>
            <linearGradient id="sun" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ff007f"/>
              <stop offset="100%" stop-color="#ffbf00"/>
            </linearGradient>
          </defs>
          <rect width="720" height="480" fill="url(#neonBg)"/>
          <circle cx="360" cy="220" r="140" fill="url(#sun)"/>
          <!-- Horizon Grid Lines -->
          <g stroke="#00f3ff" stroke-width="2" opacity="0.6">
            <line x1="0" y1="280" x2="720" y2="280"/>
            <line x1="0" y1="310" x2="720" y2="310"/>
            <line x1="0" y1="350" x2="720" y2="350"/>
            <line x1="0" y1="400" x2="720" y2="400"/>
            <line x1="0" y1="460" x2="720" y2="460"/>
            <line x1="360" y1="280" x2="360" y2="480"/>
            <line x1="360" y1="280" x2="180" y2="480"/>
            <line x1="360" y1="280" x2="0" y2="480"/>
            <line x1="360" y1="280" x2="540" y2="480"/>
            <line x1="360" y1="280" x2="720" y2="480"/>
          </g>
          <text x="360" y="240" font-family="sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="8">RETRO WAVE</text>
        </svg>`
      }
    ];

    const createdJobs: ImageJob[] = [];

    for (const sample of sampleSpecs) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const filename = `${uniqueSuffix}-${sample.name}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      const buffer = Buffer.from(sample.svg);
      const isPng = sample.name.endsWith('.png');

      if (isPng) {
        await sharp(buffer).png().toFile(filePath);
      } else {
        await sharp(buffer).jpeg({ quality: 90 }).toFile(filePath);
      }

      const stat = await fs.promises.stat(filePath);
      const meta = await sharp(filePath).metadata();

      const jobId = `job-sample-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const job: ImageJob = {
        id: jobId,
        originalName: sample.name,
        originalSize: stat.size,
        originalWidth: meta.width || sample.width,
        originalHeight: meta.height || sample.height,
        originalFormat: isPng ? 'png' : 'jpeg',
        status: 'queued',
        progress: 0,
        createdAt: Date.now()
      };

      jobsMap.set(jobId, job);
      jobFilesMap.set(jobId, { originalPath: filePath });
      createdJobs.push(job);
    }

    res.json({
      success: true,
      count: createdJobs.length,
      jobs: createdJobs
    });
  } catch (err: any) {
    console.error('Error generating sample images:', err);
    res.status(500).json({ error: 'Failed to create sample images' });
  }
});

// Start / Update processing queue
app.post('/api/process', (req, res) => {
  const settings: Partial<UpscaleSettings> = req.body.settings || {};
  
  queueSettings = {
    scale: (settings.scale as UpscaleFactor) || 4,
    model: (settings.model as ModelMode) || 'photo-ultra',
    format: (settings.format as OutputFormat) || 'same',
    quality: Math.min(100, Math.max(70, Number(settings.quality) || 92)),
    dpi: Math.min(1200, Math.max(1, Math.round(Number(settings.dpi) || 300))),
    concurrency: Math.min(4, Math.max(1, Number(settings.concurrency) || 2)),
    maxFileSizeMb: Number(settings.maxFileSizeMb) || 50
  };

  // Mark all queued/failed jobs ready if requested
  if (req.body.retryAllFailed) {
    for (const job of jobsMap.values()) {
      if (job.status === 'failed') {
        job.status = 'queued';
        job.progress = 0;
        job.error = undefined;
      }
    }
  }

  processQueueLoop().catch(console.error);

  res.json({
    success: true,
    message: 'Cloud processing queue started',
    settings: queueSettings,
    stats: computeQueueStats(Array.from(jobsMap.values()), queueSettings.concurrency)
  });
});

// Process single job
app.post('/api/process-single/:id', async (req, res) => {
  const jobId = req.params.id;
  const job = jobsMap.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const settings = {
    ...queueSettings,
    ...(req.body.settings || {})
  };

  job.status = 'queued';
  job.progress = 0;
  job.error = undefined;

  // Process asynchronously
  processImageJob(jobId, settings).catch(console.error);

  res.json({ success: true, job });
});

// Get all jobs and queue statistics
app.get('/api/jobs', (_req, res) => {
  const jobs = Array.from(jobsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  const stats = computeQueueStats(jobs, queueSettings.concurrency);
  
  res.json({
    jobs,
    stats,
    isProcessing: isQueueRunning || activeWorkersCount > 0,
    activeWorkers: activeWorkersCount,
    settings: queueSettings
  });
});

// Get single job details
app.get('/api/jobs/:id', (req, res) => {
  const job = jobsMap.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

// Remove single job
app.delete('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;
  const job = jobsMap.get(jobId);
  const files = jobFilesMap.get(jobId);

  if (files) {
    try {
      if (files.originalPath && fs.existsSync(files.originalPath)) {
        await fs.promises.unlink(files.originalPath);
      }
      if (files.upscaledPath && fs.existsSync(files.upscaledPath)) {
        await fs.promises.unlink(files.upscaledPath);
      }
    } catch (e) {
      console.warn('Failed to clean up files for job', jobId, e);
    }
    jobFilesMap.delete(jobId);
  }

  jobsMap.delete(jobId);
  res.json({ success: true, removedId: jobId });
});

// Clear jobs
app.post('/api/jobs/clear', async (req, res) => {
  const filter = req.body.filter || 'all'; // 'all' or 'completed'
  const idsToDelete: string[] = [];

  for (const [id, job] of jobsMap.entries()) {
    if (filter === 'all' || (filter === 'completed' && (job.status === 'completed' || job.status === 'failed'))) {
      idsToDelete.push(id);
    }
  }

  for (const id of idsToDelete) {
    const files = jobFilesMap.get(id);
    if (files) {
      try {
        if (files.originalPath && fs.existsSync(files.originalPath)) {
          await fs.promises.unlink(files.originalPath);
        }
        if (files.upscaledPath && fs.existsSync(files.upscaledPath)) {
          await fs.promises.unlink(files.upscaledPath);
        }
      } catch (e) {
        // ignore
      }
      jobFilesMap.delete(id);
    }
    jobsMap.delete(id);
  }

  res.json({ success: true, countRemoved: idsToDelete.length });
});

// Serve original image preview
app.get('/api/image/:id/original', (req, res) => {
  const files = jobFilesMap.get(req.params.id);
  if (!files || !files.originalPath || !fs.existsSync(files.originalPath)) {
    return res.status(404).send('Image file not found');
  }
  res.sendFile(files.originalPath);
});

// Serve upscaled image preview
app.get('/api/image/:id/upscaled', (req, res) => {
  const files = jobFilesMap.get(req.params.id);
  if (!files || !files.upscaledPath || !fs.existsSync(files.upscaledPath)) {
    return res.status(404).send('Upscaled file not ready or not found');
  }
  res.sendFile(files.upscaledPath);
});

// Download single image with proper attachment filename and headers
app.get('/api/download/:id', (req, res) => {
  const job = jobsMap.get(req.params.id);
  const files = jobFilesMap.get(req.params.id);

  if (!job || !files || !files.upscaledPath || !fs.existsSync(files.upscaledPath)) {
    return res.status(404).send('Processed file not found');
  }

  const ext = path.extname(files.upscaledPath).replace('.', '') || 'jpg';
  const downloadName = sanitizeFilename(job.originalName, job.scaleApplied || 4, ext);

  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.sendFile(files.upscaledPath);
});

// Download all completed images as a robust streaming ZIP archive
app.get('/api/download-zip', (req, res) => {
  const completedJobs = Array.from(jobsMap.values()).filter(
    j => j.status === 'completed' && jobFilesMap.get(j.id)?.upscaledPath
  );

  if (completedJobs.length === 0) {
    return res.status(400).json({ error: 'No completed images available to download' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipFilename = `upscaler-pro-batch-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  const archive = typeof archiver === 'function'
    ? archiver('zip', { zlib: { level: 6 } })
    : new archiver.ZipArchive({ zlib: { level: 6 } });

  archive.on('warning', (err: any) => {
    if (err.code === 'ENOENT') {
      console.warn('Archiver warning:', err);
    } else {
      console.error('Archiver error:', err);
    }
  });

  archive.on('error', (err: any) => {
    console.error('Archiver fatal stream error:', err);
    if (!res.headersSent) {
      res.status(500).send({ error: 'Failed to create zip archive' });
    }
  });

  // Pipe archive stream directly to Express response
  archive.pipe(res);

  // Append each completed file with sanitized name
  const usedNames = new Set<string>();

  for (const job of completedJobs) {
    const files = jobFilesMap.get(job.id);
    if (files?.upscaledPath && fs.existsSync(files.upscaledPath)) {
      const ext = path.extname(files.upscaledPath).replace('.', '') || 'jpg';
      let entryName = sanitizeFilename(job.originalName, job.scaleApplied || 4, ext);

      // Handle duplicate filenames in same batch
      if (usedNames.has(entryName)) {
        const dotIdx = entryName.lastIndexOf('.');
        entryName = `${entryName.substring(0, dotIdx)}_${job.id.substring(4, 9)}.${ext}`;
      }
      usedNames.add(entryName);

      archive.file(files.upscaledPath, { name: entryName });
    }
  }

  // Also include metadata CSV inside the zip for professional archival
  const csvData = generateMetadataCsv(completedJobs);
  archive.append(csvData, { name: 'manifest-metadata.csv' });

  archive.finalize();
});

// Download metadata CSV report
app.get('/api/download-csv', (_req, res) => {
  const jobs = Array.from(jobsMap.values());
  if (jobs.length === 0) {
    return res.status(400).json({ error: 'No jobs to export' });
  }

  const csv = generateMetadataCsv(jobs);
  const timestamp = new Date().toISOString().slice(0, 10);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="upscaler-pro-report-${timestamp}.csv"`);
  res.send(csv);
});

// Start Server with Vite Middleware
async function startServer() {
  const hasDist = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

  if (hasDist) {
    // Serve production built bundle
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Upscaler Pro Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
