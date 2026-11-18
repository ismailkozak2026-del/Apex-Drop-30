import React, { useRef, useState } from 'react';
import { RotateCcw, Save, Sliders, X } from 'lucide-react';
import {
  clampHudControl,
  getPresetLayout,
  HUD_CONTROL_IDS,
  HUD_CONTROL_LABELS,
} from '../shared/hudLayout';
import type { HudControlId, HudLayoutPreset, HudSettings } from '../shared/types';

interface HudSettingsModalProps {
  settings: HudSettings;
  onSave: (next: HudSettings) => void;
  onClose: () => void;
}

export const HudSettingsModal: React.FC<HudSettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<HudSettings>(() => ({
    preset: settings.preset,
    controls: { ...settings.controls },
  }));
  const [selectedId, setSelectedId] = useState<HudControlId>('fireMain');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<HudControlId | null>(null);

  const applyPreset = (preset: HudLayoutPreset) => {
    setDraft(getPresetLayout(preset));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const yPct = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    const id = draggingRef.current;
    setDraft((prev) => ({
      ...prev,
      controls: {
        ...prev.controls,
        [id]: clampHudControl({
          ...prev.controls[id],
          xPct,
          yPct,
        }),
      },
    }));
  };

  const handleScaleChange = (scale: number) => {
    setDraft((prev) => ({
      ...prev,
      controls: {
        ...prev.controls,
        [selectedId]: clampHudControl({
          ...prev.controls[selectedId],
          scale,
        }),
      },
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="hud-settings-modal"
    >
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-xl font-bold tracking-wide">
              HUD & Dokunmatik Kontrol Düzeni
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Presets & Scale Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Hazır Düzen:</span>
            {(
              [
                ['default', 'Varsayılan'],
                ['lefty', 'Solak'],
                ['claw4', '4 Parmak Claw'],
              ] as Array<[HudLayoutPreset, string]>
            ).map(([presetKey, label]) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => applyPreset(presetKey)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  draft.preset === presetKey
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300">
              {HUD_CONTROL_LABELS[selectedId]} Ölçeği:
            </span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={draft.controls[selectedId].scale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-32 accent-amber-500"
            />
            <span className="font-mono-tabular w-10 text-right text-xs font-bold text-amber-300">
              {draft.controls[selectedId].scale.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* Interactive Drag-and-Drop Stage */}
        <div
          ref={stageRef}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            draggingRef.current = null;
          }}
          onPointerLeave={() => {
            draggingRef.current = null;
          }}
          className="relative h-72 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950 select-none touch-none"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            6 kontrol öğesini sürükleyip bırakarak konumlandırın
          </div>

          {HUD_CONTROL_IDS.map((id) => {
            const ctrl = draft.controls[id];
            const isSelected = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSelectedId(id);
                  draggingRef.current = id;
                }}
                style={{
                  left: `${ctrl.xPct}%`,
                  top: `${ctrl.yPct}%`,
                  transform: `translate(-50%, -50%) scale(${ctrl.scale})`,
                }}
                className={`absolute rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap cursor-grab active:cursor-grabbing ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/25 text-amber-200 ring-2 ring-amber-400/50'
                    : 'border-slate-600 bg-slate-800/90 text-slate-200 hover:border-slate-400'
                }`}
              >
                {HUD_CONTROL_LABELS[id]}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => applyPreset('default')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Varsayılana Sıfırla</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
