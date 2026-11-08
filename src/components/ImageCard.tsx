import React from 'react';
import { Download, Eye, Trash2, RotateCw, CheckCircle2, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { ImageJob } from '../types.js';
import { formatBytes } from '../utils/queueLogic.js';

interface ImageCardProps {
  job: ImageJob;
  onDownload: (job: ImageJob) => void;
  onCompare: (job: ImageJob) => void;
  onRemove: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  job,
  onDownload,
  onCompare,
  onRemove,
  onRetry
}) => {
  const isCompleted = job.status === 'completed';
  const isProcessing = job.status === 'processing';
  const isFailed = job.status === 'failed';
  const isQueued = job.status === 'queued';

  const previewUrl = isCompleted
    ? `/api/image/${job.id}/upscaled`
    : `/api/image/${job.id}/original`;

  return (
    <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md hover:border-[#CBD5E1] group">
      {/* Thumbnail area */}
      <div className="relative aspect-4/3 w-full bg-[#E2E8F0] overflow-hidden flex items-center justify-center">
        <img
          src={previewUrl}
          alt={job.originalName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // fallback placeholder if image cannot be rendered
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Status Overlay Badge */}
        <div className="absolute top-2.5 left-2.5">
          {isCompleted && (
            <span className="flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              {job.scaleApplied || 4}X Done
            </span>
          )}
          {isProcessing && (
            <span className="flex items-center gap-1 bg-[#635BFF] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin" />
              Processing
            </span>
          )}
          {isQueued && (
            <span className="flex items-center gap-1 bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              <Clock className="w-3 h-3" />
              In Queue
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-1 bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              <AlertTriangle className="w-3 h-3" />
              Failed
            </span>
          )}
        </div>

        {/* DPI Badge if completed */}
        {isCompleted && job.dpiApplied && (
          <div className="absolute top-2.5 right-2.5 bg-white/95 text-[#202438] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#E2E8F0] shadow-xs">
            {job.dpiApplied} DPI
          </div>
        )}

        {/* Progress Bar overlay for processing */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-200">
            <div
              className="h-full bg-[#635BFF] transition-all duration-300"
              style={{ width: `${Math.max(15, job.progress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div>
          <h4
            className="text-sm font-bold text-[#202438] truncate"
            title={job.originalName}
          >
            {job.originalName}
          </h4>

          {/* Resolution specs */}
          <div className="mt-2 text-xs flex items-center gap-1.5 text-[#5B6275]">
            <span className="font-mono font-medium">
              {job.originalWidth || '?'}×{job.originalHeight || '?'}
            </span>
            <ArrowRight className="w-3 h-3 text-[#635BFF]" />
            <span className="font-mono font-bold text-[#202438]">
              {job.upscaledWidth ? `${job.upscaledWidth}×${job.upscaledHeight}` : '—'}
            </span>
          </div>

          {/* Size specs */}
          <div className="mt-1 text-[11px] text-[#5B6275] flex items-center justify-between">
            <span>Original: {formatBytes(job.originalSize)}</span>
            {isCompleted && job.upscaledSize && (
              <span className="font-semibold text-emerald-700">
                Upscaled: {formatBytes(job.upscaledSize)}
              </span>
            )}
          </div>

          {/* Processing duration */}
          {isCompleted && job.processingTimeMs && (
            <div className="mt-1 text-[10px] text-[#5B6275]">
              Cloud Render Time: {(job.processingTimeMs / 1000).toFixed(2)}s
            </div>
          )}

          {/* Error Message if failed */}
          {isFailed && job.error && (
            <div className="mt-1 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded-lg">
              {job.error}
            </div>
          )}
        </div>

        {/* Card Actions */}
        <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between gap-1.5">
          {isCompleted ? (
            <>
              <button
                type="button"
                onClick={() => onCompare(job)}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#202438] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Interactive Before/After Comparison"
              >
                <Eye className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Compare</span>
              </button>

              <button
                type="button"
                onClick={() => onDownload(job)}
                className="flex-1 py-1.5 px-2 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                title="Download this single image with embedded DPI"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </>
          ) : isFailed ? (
            <button
              type="button"
              onClick={() => onRetry(job.id)}
              className="flex-1 py-1.5 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          ) : (
            <span className="text-xs text-[#5B6275] italic">
              {isProcessing ? 'Upscaling on server...' : 'Waiting for worker...'}
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(job.id)}
            className="p-1.5 text-[#5B6275] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Remove image from queue"
            aria-label={`Remove ${job.originalName}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
