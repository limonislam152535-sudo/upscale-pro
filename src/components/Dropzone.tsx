import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  isUploading: boolean;
  maxFileSizeMb: number;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  onLoadSamples,
  isUploading,
  maxFileSizeMb
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-200 mb-8 ${
        isDragOver
          ? 'border-[#635BFF] bg-[#635BFF]/5 scale-[1.005]'
          : 'border-[#CBD5E1] bg-[#F7F8FC] hover:border-[#94A3B8] hover:bg-[#EEF1F8]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="bulk-image-input"
        aria-label="Upload multiple images"
      />

      <div className="max-w-xl mx-auto flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center text-[#635BFF] mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-[#202438] mb-1.5">
          Drag & Drop Bulk Images (Up to 200+ Files)
        </h3>
        <p className="text-sm text-[#5B6275] mb-5">
          Supports JPG, PNG, and WEBP up to {maxFileSizeMb}MB per file • Zero CPU/GPU usage on your machine
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] text-white font-bold text-sm shadow-md shadow-[#635BFF]/20 transition-all cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Select Files from Computer</span>
          </button>

          <button
            type="button"
            disabled={isUploading}
            onClick={onLoadSamples}
            className="px-5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#202438] font-semibold text-sm shadow-xs transition-all cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#635BFF]" />
            <span>Load Test Sample Images</span>
          </button>
        </div>

        {isUploading && (
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#635BFF] bg-white px-4 py-2 rounded-full border border-[#E2E8F0] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#635BFF] animate-ping" />
            Uploading original files to cloud storage...
          </div>
        )}
      </div>
    </div>
  );
};
