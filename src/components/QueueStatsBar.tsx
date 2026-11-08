import React from 'react';
import { Clock, Activity, CheckCircle2, AlertCircle, HardDrive, Gauge } from 'lucide-react';
import { QueueStats } from '../types.js';
import { formatBytes, formatDuration } from '../utils/queueLogic.js';

interface QueueStatsBarProps {
  stats: QueueStats;
  isProcessing: boolean;
}

export const QueueStatsBar: React.FC<QueueStatsBarProps> = ({ stats, isProcessing }) => {
  const percentCompleted = stats.total > 0
    ? Math.round(((stats.completed + stats.failed) / stats.total) * 100)
    : 0;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 mb-6 shadow-xs">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Total Images</span>
            <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
          </div>
          <div className="text-2xl font-extrabold text-[#202438] mt-1.5">{stats.total}</div>
          <div className="text-[11px] text-[#5B6275] mt-0.5">
            {formatBytes(stats.totalOriginalBytes)} uploaded
          </div>
        </div>

        {/* Queued */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Queued</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-[#202438] mt-1.5">{stats.queued}</div>
          <div className="text-[11px] text-[#5B6275] mt-0.5">Awaiting cloud slot</div>
        </div>

        {/* Processing */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl relative overflow-hidden">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Processing</span>
            <span className={`w-2 h-2 rounded-full ${stats.processing > 0 ? 'bg-[#635BFF] animate-ping' : 'bg-slate-300'}`} />
          </div>
          <div className="text-2xl font-extrabold text-[#635BFF] mt-1.5 flex items-center gap-2">
            {stats.processing}
            {stats.processing > 0 && (
              <span className="text-xs font-medium text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded-md animate-pulse">
                Active
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#5B6275] mt-0.5 truncate" title={stats.currentProcessingName}>
            {stats.currentProcessingName ? `Up: ${stats.currentProcessingName}` : 'Idle'}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1.5">{stats.completed}</div>
          <div className="text-[11px] text-[#5B6275] mt-0.5">
            {formatBytes(stats.totalUpscaledBytes)} generated
          </div>
        </div>

        {/* Speed */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Throughput</span>
            <Gauge className="w-3.5 h-3.5 text-[#635BFF]" />
          </div>
          <div className="text-2xl font-extrabold text-[#202438] mt-1.5">
            {stats.throughputPerMinute || 32}
            <span className="text-xs font-semibold text-[#5B6275] ml-1">img/m</span>
          </div>
          <div className="text-[11px] text-[#5B6275] mt-0.5">
            ~{(stats.avgProcessingTimeMs / 1000).toFixed(1)}s per image
          </div>
        </div>

        {/* ETA */}
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] p-3.5 rounded-xl">
          <div className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center justify-between">
            <span>Est. Remaining</span>
            <Clock className="w-3.5 h-3.5 text-[#635BFF]" />
          </div>
          <div className="text-2xl font-extrabold text-[#202438] mt-1.5">
            {stats.queued + stats.processing > 0 ? formatDuration(stats.estimatedRemainingTimeSec) : '0s'}
          </div>
          <div className="text-[11px] text-[#5B6275] mt-0.5">
            {stats.queued + stats.processing > 0 ? 'Continuous queue' : 'Queue clear'}
          </div>
        </div>
      </div>

      {/* Real Progress Bar */}
      {stats.total > 0 && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#202438] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#635BFF]" />
              Queue Progress: {percentCompleted}% ({stats.completed + stats.failed} of {stats.total} images)
            </span>
            <span className="text-[#5B6275]">
              {isProcessing ? 'Processing on Cloud Engine...' : percentCompleted === 100 ? 'All Jobs Finished' : 'Waiting to start'}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F7F8FC] rounded-full overflow-hidden border border-[#E2E8F0]">
            <div
              className="h-full bg-gradient-to-r from-[#635BFF] to-[#8075FF] transition-all duration-300 rounded-full"
              style={{ width: `${percentCompleted}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
