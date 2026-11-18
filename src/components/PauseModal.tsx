import React from 'react';
import { Home, Play, Sliders, Volume2, VolumeX } from 'lucide-react';

interface PauseModalProps {
  muted: boolean;
  onResume: () => void;
  onOpenHudSettings: () => void;
  onToggleMute: () => void;
  onReturnToLobby: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  muted,
  onResume,
  onOpenHudSettings,
  onToggleMute,
  onReturnToLobby,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="pause-modal"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <h2 className="font-display text-2xl font-bold tracking-wide text-amber-400">
          OYUN DURAKLATILDI
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          İstediğiniz zaman arenaya geri dönebilirsiniz.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Devam Et</span>
          </button>

          <button
            type="button"
            onClick={onOpenHudSettings}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <Sliders className="h-4 w-4 text-amber-400" />
            <span>HUD Düzeni Ayarları</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
            <span>{muted ? 'Sesi Aç' : 'Sesi Kapat'}</span>
          </button>

          <button
            type="button"
            onClick={onReturnToLobby}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/70 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-900 cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>Lobiye Dön</span>
          </button>
        </div>
      </div>
    </div>
  );
};
