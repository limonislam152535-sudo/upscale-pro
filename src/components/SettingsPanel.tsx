import React, { useState, useEffect } from 'react';
import { Sliders, Layers, FileImage, Printer, Cpu, ShieldCheck, Sparkles } from 'lucide-react';
import { UpscaleSettings, UpscaleFactor, ModelMode, OutputFormat } from '../types.js';

interface SettingsPanelProps {
  settings: UpscaleSettings;
  onChange: (newSettings: UpscaleSettings) => void;
  disabled?: boolean;
}

const DPI_PRESETS = [72, 150, 300, 600, 1200];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChange,
  disabled = false
}) => {
  const isPreset = DPI_PRESETS.includes(settings.dpi) && !settings.isCustomDpi;
  const [selectedDropdown, setSelectedDropdown] = useState<string>(
    isPreset ? String(settings.dpi) : 'custom'
  );
  const [customDpiText, setCustomDpiText] = useState<string>(String(settings.dpi || 300));

  useEffect(() => {
    if (DPI_PRESETS.includes(settings.dpi) && !settings.isCustomDpi) {
      setSelectedDropdown(String(settings.dpi));
    } else {
      setSelectedDropdown('custom');
    }
    setCustomDpiText(String(settings.dpi));
  }, [settings.dpi, settings.isCustomDpi]);

  const updateSetting = <K extends keyof UpscaleSettings>(key: K, value: UpscaleSettings[K]) => {
    onChange({
      ...settings,
      [key]: value
    });
  };

  const handleDropdownChange = (val: string) => {
    setSelectedDropdown(val);
    if (val === 'custom') {
      const current = Math.min(1200, Math.max(1, Number(customDpiText) || settings.dpi || 300));
      onChange({
        ...settings,
        dpi: current,
        isCustomDpi: true,
        customDpi: current
      });
    } else {
      const num = Number(val);
      setCustomDpiText(String(num));
      onChange({
        ...settings,
        dpi: num,
        isCustomDpi: false
      });
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setCustomDpiText(rawVal);
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(1200, Math.max(1, parsed));
      onChange({
        ...settings,
        dpi: clamped,
        isCustomDpi: true,
        customDpi: clamped
      });
    }
  };

  const handleCustomInputBlur = () => {
    const parsed = parseInt(customDpiText, 10);
    const valid = isNaN(parsed) ? 300 : Math.min(1200, Math.max(1, parsed));
    setCustomDpiText(String(valid));
    onChange({
      ...settings,
      dpi: valid,
      isCustomDpi: true,
      customDpi: valid
    });
  };

  return (
    <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-2xl p-5 mb-6 shadow-xs">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[#635BFF]" />
          <h2 className="text-base font-bold text-[#202438]">Global Upscaling Engine Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#635BFF] bg-[#635BFF]/10 px-2.5 py-1 rounded-md border border-[#635BFF]/20 font-bold">
            Max 1200 DPI Supported
          </span>
          <span className="text-xs text-[#5B6275] bg-white px-2.5 py-1 rounded-md border border-[#E2E8F0] font-medium hidden sm:inline">
            Zero Client Load • Cloud Enforced
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {/* 1. Scale Factor */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#635BFF]" />
            Upscale Factor
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-[#E2E8F0]">
            {([2, 4, 8] as UpscaleFactor[]).map((factor) => (
              <button
                key={factor}
                type="button"
                disabled={disabled}
                onClick={() => updateSetting('scale', factor)}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  settings.scale === factor
                    ? 'bg-[#635BFF] text-white shadow-xs'
                    : 'text-[#202438] hover:bg-[#F7F8FC]'
                }`}
              >
                {factor}X
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#5B6275]">
            {settings.scale === 2 && 'Fast 2X pixel quadrupling'}
            {settings.scale === 4 && 'Standard 4X (16X pixel density)'}
            {settings.scale === 8 && 'Ultra 8X (64X ultra mega-res)'}
          </p>
        </div>

        {/* 2. Model Mode */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#635BFF]" />
            AI Model Engine
          </label>
          <select
            disabled={disabled}
            value={settings.model}
            onChange={(e) => updateSetting('model', e.target.value as ModelMode)}
            className="w-full bg-white border border-[#E2E8F0] text-[#202438] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all"
          >
            <option value="photo-ultra">Real-ESRGAN Photo Ultra</option>
            <option value="anime-art">Anime & Illustration</option>
            <option value="digital-graphics">Digital Art & Graphics</option>
            <option value="balanced-universal">Balanced Universal</option>
          </select>
          <p className="text-[11px] text-[#5B6275]">
            {settings.model === 'photo-ultra' && 'Micro-contrast & skin/texture recovery'}
            {settings.model === 'anime-art' && 'Clean lineart & flat color smoothing'}
            {settings.model === 'digital-graphics' && 'Vector-sharp edges & logos'}
            {settings.model === 'balanced-universal' && 'Fast high-precision Lanczos-3'}
          </p>
        </div>

        {/* 3. Output Format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center gap-1.5">
            <FileImage className="w-3.5 h-3.5 text-[#635BFF]" />
            Output Format
          </label>
          <select
            disabled={disabled}
            value={settings.format}
            onChange={(e) => updateSetting('format', e.target.value as OutputFormat)}
            className="w-full bg-white border border-[#E2E8F0] text-[#202438] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all"
          >
            <option value="same">Preserve Original (Auto)</option>
            <option value="jpeg">JPEG (Universal)</option>
            <option value="png">PNG (Lossless)</option>
            <option value="webp">WEBP (Compact)</option>
          </select>
          <p className="text-[11px] text-[#5B6275]">
            {settings.format === 'same' ? 'Maintains original file format' : `Converts all output to ${settings.format.toUpperCase()}`}
          </p>
        </div>

        {/* 4. JPEG Quality */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider">
              Output Quality
            </label>
            <span className="text-xs font-bold text-[#635BFF] bg-white px-2 py-0.5 rounded-md border border-[#E2E8F0]">
              {settings.quality}%
            </span>
          </div>
          <input
            type="range"
            min="70"
            max="100"
            step="1"
            disabled={disabled}
            value={settings.quality}
            onChange={(e) => updateSetting('quality', Number(e.target.value))}
            className="w-full accent-[#635BFF] cursor-pointer mt-2"
          />
          <div className="flex justify-between text-[10px] text-[#5B6275]">
            <span>70% (Compact)</span>
            <span>92% (Optimal)</span>
            <span>100% (Max)</span>
          </div>
        </div>

        {/* 5. Print DPI (Max 1200 DPI + Custom Setting) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-[#635BFF]" />
              Print DPI
            </label>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              {settings.dpi} DPI
            </span>
          </div>

          <select
            disabled={disabled}
            value={selectedDropdown}
            onChange={(e) => handleDropdownChange(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] text-[#202438] text-xs font-medium rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all"
            aria-label="Select DPI preset or custom"
          >
            <option value="72">72 DPI (Web & Screen)</option>
            <option value="150">150 DPI (Balanced Print)</option>
            <option value="300">300 DPI (Commercial Standard)</option>
            <option value="600">600 DPI (Fine Art Gallery)</option>
            <option value="1200">1200 DPI (Max Archival Master)</option>
            <option value="custom">⚙️ Custom DPI (1 – 1200 DPI)...</option>
          </select>

          {/* Custom DPI Numeric Input Field */}
          {selectedDropdown === 'custom' && (
            <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max="1200"
                  disabled={disabled}
                  value={customDpiText}
                  onChange={handleCustomInputChange}
                  onBlur={handleCustomInputBlur}
                  placeholder="1 - 1200"
                  className="w-full bg-white border border-[#635BFF] text-[#202438] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#635BFF]/30 pr-12 shadow-xs"
                  aria-label="Enter custom DPI up to 1200"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#635BFF]">
                  DPI
                </span>
              </div>
              <div className="text-[10px] text-[#5B6275] whitespace-nowrap bg-white px-2 py-1.5 rounded-lg border border-[#E2E8F0] font-mono">
                Max 1200
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#5B6275]">
            {settings.dpi > 600
              ? `Ultra-high ${settings.dpi} DPI master print metadata written to EXIF`
              : 'Physical density metadata written directly into EXIF/JFIF header'}
          </p>
        </div>

        {/* 6. Concurrency */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5B6275] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#635BFF]" />
            Cloud Concurrency
          </label>
          <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-[#E2E8F0]">
            {[1, 2, 3, 4].map((workers) => (
              <button
                key={workers}
                type="button"
                disabled={disabled}
                onClick={() => updateSetting('concurrency', workers)}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  settings.concurrency === workers
                    ? 'bg-[#635BFF] text-white shadow-xs'
                    : 'text-[#202438] hover:bg-[#F7F8FC]'
                }`}
              >
                {workers}x
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#5B6275]">
            Parallel server workers (max 4 to protect RAM)
          </p>
        </div>
      </div>
    </div>
  );
};
