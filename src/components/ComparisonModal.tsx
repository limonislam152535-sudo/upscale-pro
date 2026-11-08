import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2, SplitSquareVertical } from 'lucide-react';
import { ImageJob } from '../types.js';
import { formatBytes } from '../utils/queueLogic.js';

interface ComparisonModalProps {
  job: ImageJob | null;
  onClose: () => void;
  onDownload: (job: ImageJob) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  job,
  onClose,
  onDownload
}) => {
  if (!job) return null;

  const [sliderPos, setSliderPos] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [isSideBySide, setIsSideBySide] = useState(false);

  const originalUrl = `/api/image/${job.id}/original`;
  const upscaledUrl = `/api/image/${job.id}/upscaled`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-[#E2E8F0]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F7F8FC]">
          <div>
            <h3 className="text-base font-bold text-[#202438] flex items-center gap-2">
              <span>Before & After Quality Inspection</span>
              <span className="text-xs bg-[#635BFF] text-white px-2 py-0.5 rounded-full font-bold">
                {job.scaleApplied || 4}X Upscaled
              </span>
            </h3>
            <p className="text-xs text-[#5B6275] mt-0.5 font-mono">
              {job.originalName} • {job.originalWidth}×{job.originalHeight} ({formatBytes(job.originalSize)}) ➔ {job.upscaledWidth}×{job.upscaledHeight} ({formatBytes(job.upscaledSize || 0)})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSideBySide(!isSideBySide)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isSideBySide
                  ? 'bg-[#635BFF] text-white border-[#635BFF]'
                  : 'bg-white text-[#202438] border-[#E2E8F0] hover:bg-[#F7F8FC]'
              }`}
              title="Toggle Side-by-Side View"
            >
              <SplitSquareVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Side by Side</span>
            </button>

            <button
              onClick={() => onDownload(job)}
              className="bg-[#635BFF] hover:bg-[#5046E5] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#5B6275] hover:text-[#202438] hover:bg-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas */}
        <div className="relative flex-1 min-h-[420px] max-h-[68vh] bg-[#F1F5F9] overflow-hidden flex items-center justify-center p-4">
          {!isSideBySide ? (
            /* Split Slider Comparison */
            <div className="relative w-full h-full max-w-4xl max-h-[64vh] rounded-2xl overflow-hidden select-none shadow-md border border-[#CBD5E1] bg-white flex items-center justify-center">
              {/* Upscaled (Background / Right side) */}
              <img
                src={upscaledUrl}
                alt="Upscaled AI Super-Resolution"
                className="w-full h-full object-contain pointer-events-none transition-transform duration-100"
                style={{ transform: `scale(${zoom})` }}
              />

              {/* Original (Clipped Left side) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${sliderPos}%` }}
              >
                <img
                  src={originalUrl}
                  alt="Original Low-Res"
                  className="w-full h-full object-contain pointer-events-none max-w-none transition-transform duration-100"
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: `scale(${zoom})`
                  }}
                />
              </div>

              {/* Slider Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none flex items-center justify-center"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-[#635BFF] text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
                  ↔
                </div>
              </div>

              {/* Range Input for dragging slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20"
                aria-label="Before and after slider position"
              />

              {/* Labels */}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs text-[#202438] text-xs font-bold px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm pointer-events-none z-10">
                Original (Low Res)
              </div>
              <div className="absolute top-4 right-4 bg-[#635BFF]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm pointer-events-none z-10">
                Upscaled ({job.scaleApplied || 4}X AI Super-Res)
              </div>
            </div>
          ) : (
            /* Side-by-Side Comparison */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full h-full max-h-[64vh]">
              <div className="relative rounded-2xl overflow-hidden bg-white border border-[#CBD5E1] flex flex-col">
                <div className="p-2.5 bg-[#F7F8FC] border-b border-[#E2E8F0] text-xs font-bold text-[#202438] flex items-center justify-between">
                  <span>Original Image</span>
                  <span className="font-mono text-[11px] text-[#5B6275]">
                    {job.originalWidth}×{job.originalHeight}
                  </span>
                </div>
                <div className="flex-1 p-2 overflow-auto flex items-center justify-center">
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-h-full max-w-full object-contain"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-white border border-[#CBD5E1] flex flex-col">
                <div className="p-2.5 bg-[#F7F8FC] border-b border-[#E2E8F0] text-xs font-bold text-[#635BFF] flex items-center justify-between">
                  <span>Upscaled Result ({job.scaleApplied || 4}X)</span>
                  <span className="font-mono text-[11px] text-[#5B6275]">
                    {job.upscaledWidth}×{job.upscaledHeight} ({job.dpiApplied || 300} DPI)
                  </span>
                </div>
                <div className="flex-1 p-2 overflow-auto flex items-center justify-center">
                  <img
                    src={upscaledUrl}
                    alt="Upscaled"
                    className="max-h-full max-w-full object-contain"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-white flex items-center justify-between text-xs text-[#5B6275]">
          <div className="flex items-center gap-2">
            <span>Zoom View:</span>
            <button
              onClick={() => setZoom(Math.max(1, zoom - 0.5))}
              className="p-1 rounded-lg hover:bg-[#F7F8FC] border border-[#E2E8F0] text-[#202438]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-[#202438]">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.5))}
              className="p-1 rounded-lg hover:bg-[#F7F8FC] border border-[#E2E8F0] text-[#202438]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="ml-1 text-[11px] underline hover:text-[#202438]"
            >
              Reset
            </button>
          </div>

          <div>
            Drag slider left or right to inspect fine texture reconstruction
          </div>
        </div>
      </div>
    </div>
  );
};
