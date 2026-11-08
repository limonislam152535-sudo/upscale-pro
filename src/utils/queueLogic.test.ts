import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  calculateTargetDimensions,
  calculateEta,
  formatDuration,
  sanitizeFilename,
  computeQueueStats,
  generateMetadataCsv
} from './queueLogic.js';
import { ImageJob } from '../types.js';

test('formatBytes formats bytes into human readable units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
});

test('calculateTargetDimensions correctly scales width and height', () => {
  const dim2x = calculateTargetDimensions(1920, 1080, 2);
  assert.equal(dim2x.width, 3840);
  assert.equal(dim2x.height, 2160);

  const dim4x = calculateTargetDimensions(800, 600, 4);
  assert.equal(dim4x.width, 3200);
  assert.equal(dim4x.height, 2400);

  const dim8x = calculateTargetDimensions(500, 500, 8);
  assert.equal(dim8x.width, 4000);
  assert.equal(dim8x.height, 4000);
});

test('calculateEta computes realistic estimated remaining seconds', () => {
  assert.equal(calculateEta(0, 2000, 2), 0);
  // 10 items, 2000ms each, concurrency 2 => 5 batches * 2s = 10s
  assert.equal(calculateEta(10, 2000, 2), 10);
  // 1 item, 1000ms, concurrency 1 => 1 batch * 1s = 1s
  assert.equal(calculateEta(1, 1000, 1), 1);
});

test('formatDuration formats seconds accurately', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(125), '2m 5s');
  assert.equal(formatDuration(3660), '1h 1m');
});

test('sanitizeFilename produces safe, clean upscaled filenames', () => {
  assert.equal(sanitizeFilename('banner.jpg', 4, 'jpg'), 'banner_4x_upscaled.jpg');
  assert.equal(sanitizeFilename('my photo 2026!.png', 2, 'webp'), 'my_photo_2026__2x_upscaled.webp');
});

test('computeQueueStats aggregates state counts and throughput', () => {
  const mockJobs: ImageJob[] = [
    {
      id: '1',
      originalName: 'test1.jpg',
      originalSize: 1000000,
      originalWidth: 800,
      originalHeight: 600,
      originalFormat: 'jpeg',
      status: 'completed',
      progress: 100,
      upscaledSize: 4000000,
      upscaledWidth: 3200,
      upscaledHeight: 2400,
      processingTimeMs: 1500,
      createdAt: Date.now() - 5000,
      completedAt: Date.now()
    },
    {
      id: '2',
      originalName: 'test2.png',
      originalSize: 2000000,
      originalWidth: 1000,
      originalHeight: 1000,
      originalFormat: 'png',
      status: 'processing',
      progress: 50,
      createdAt: Date.now() - 1000
    },
    {
      id: '3',
      originalName: 'test3.webp',
      originalSize: 500000,
      originalWidth: 400,
      originalHeight: 400,
      originalFormat: 'webp',
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    },
    {
      id: '4',
      originalName: 'bad.jpg',
      originalSize: 100000,
      originalWidth: 0,
      originalHeight: 0,
      originalFormat: 'jpeg',
      status: 'failed',
      progress: 0,
      error: 'Corrupt file header',
      createdAt: Date.now()
    }
  ];

  const stats = computeQueueStats(mockJobs, 2);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 1);
  assert.equal(stats.processing, 1);
  assert.equal(stats.queued, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.totalOriginalBytes, 3600000);
  assert.equal(stats.totalUpscaledBytes, 4000000);
  assert.equal(stats.currentProcessingName, 'test2.png');
  assert.equal(stats.avgProcessingTimeMs, 1500);
  assert(stats.estimatedRemainingTimeSec > 0);
});

test('generateMetadataCsv produces RFC4180 compliant CSV', () => {
  const jobs: ImageJob[] = [
    {
      id: 'job-1',
      originalName: 'photo, "landscape".jpg',
      originalSize: 1048576,
      originalWidth: 1920,
      originalHeight: 1080,
      originalFormat: 'jpeg',
      status: 'completed',
      progress: 100,
      scaleApplied: 4,
      upscaledWidth: 7680,
      upscaledHeight: 4320,
      upscaledSize: 5242880,
      dpiApplied: 300,
      modelApplied: 'photo-ultra',
      processingTimeMs: 1420,
      createdAt: 1772990000000,
      completedAt: 1772990001420
    }
  ];

  const csv = generateMetadataCsv(jobs);
  assert(csv.includes('Job ID,Original File Name'));
  assert(csv.includes('job-1'));
  assert(csv.includes('"photo, ""landscape"".jpg"'));
  assert(csv.includes('7680'));
  assert(csv.includes('300'));
});

test('generateMetadataCsv supports max 1200 DPI and custom DPI correctly', () => {
  const jobs: ImageJob[] = [
    {
      id: 'job-1200',
      originalName: 'fine_art_gallery.jpg',
      originalSize: 5000000,
      originalWidth: 2000,
      originalHeight: 2000,
      originalFormat: 'jpeg',
      status: 'completed',
      progress: 100,
      scaleApplied: 4,
      upscaledWidth: 8000,
      upscaledHeight: 8000,
      upscaledSize: 18000000,
      dpiApplied: 1200,
      modelApplied: 'photo-ultra',
      processingTimeMs: 2500,
      createdAt: Date.now() - 3000,
      completedAt: Date.now()
    },
    {
      id: 'job-custom-dpi',
      originalName: 'custom_print.png',
      originalSize: 2000000,
      originalWidth: 1000,
      originalHeight: 1000,
      originalFormat: 'png',
      status: 'completed',
      progress: 100,
      scaleApplied: 2,
      upscaledWidth: 2000,
      upscaledHeight: 2000,
      upscaledSize: 5000000,
      dpiApplied: 450,
      modelApplied: 'digital-graphics',
      processingTimeMs: 1200,
      createdAt: Date.now() - 2000,
      completedAt: Date.now()
    }
  ];

  const csv = generateMetadataCsv(jobs);
  assert(csv.includes('job-1200'));
  assert(csv.includes('1200'));
  assert(csv.includes('job-custom-dpi'));
  assert(csv.includes('450'));
});
