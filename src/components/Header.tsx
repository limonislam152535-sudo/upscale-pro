import React from 'react';
import { Sparkles, Server, Zap, Cpu, Code2 } from 'lucide-react';
import { ServerTelemetry } from '../types.js';

interface HeaderProps {
  telemetry: ServerTelemetry | null;
  onOpenCodeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ telemetry, onOpenCodeModal }) => {
  return (
    <header className="border-b border-[#E2E8F0] bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#635BFF] flex items-center justify-center text-white shadow-md shadow-[#635BFF]/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#202438]">Upscaler Pro</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#635BFF]/10 text-[#635BFF] border border-[#635BFF]/20">
                v2.4 Cloud
              </span>
            </div>
            <p className="text-xs text-[#5B6275] hidden sm:block">
              Zero Local Strain • High Concurrency Real-ESRGAN Cloud Cluster
            </p>
          </div>
        </div>

        {/* Server status & Unlimited pill */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-[#F7F8FC] border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-xs text-[#202438]">
            <Server className="w-3.5 h-3.5 text-[#635BFF]" />
            <span className="font-medium">Cloud Server:</span>
            <span className="text-[#5B6275]">
              {telemetry ? `${telemetry.memoryUsedMb}MB / ${telemetry.memoryTotalMb}MB RAM` : 'Online'}
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unlimited Quota</span>
          </div>

          <button
            onClick={onOpenCodeModal}
            className="flex items-center gap-1.5 bg-white hover:bg-[#F7F8FC] border border-[#E2E8F0] text-[#202438] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs"
            title="View Python FastAPI & Docker Deliverables"
            aria-label="View Python FastAPI & Docker Deliverables"
          >
            <Code2 className="w-3.5 h-3.5 text-[#635BFF]" />
            <span className="hidden sm:inline">Production Code</span>
          </button>
        </div>
      </div>
    </header>
  );
};
