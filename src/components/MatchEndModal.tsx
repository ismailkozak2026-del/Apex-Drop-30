import React from 'react';
import { Home, RotateCcw, Trophy, Skull } from 'lucide-react';
import type { MatchSummary } from '../shared/types';

interface MatchEndModalProps {
  summary: MatchSummary;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
}

export const MatchEndModal: React.FC<MatchEndModalProps> = ({
  summary,
  onPlayAgain,
  onReturnToLobby,
}) => {
  const isVictory = summary.outcome === 'victory';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="match-end-modal"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-3">
          {isVictory ? (
            <Trophy className="h-8 w-8 text-amber-400" />
          ) : (
            <Skull className="h-8 w-8 text-rose-400" />
          )}
          <div>
            <h2
              className={`font-display text-2xl font-bold tracking-wide ${
                isVictory ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {isVictory ? 'ZAFER · ARENA ŞAMPİYONU' : 'ELENDİN'}
            </h2>
            {!isVictory && summary.eliminatedBy && (
              <p className="text-xs text-slate-400">
                Eleyen: <span className="font-semibold text-slate-200">{summary.eliminatedBy}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <div>
            <div className="text-[11px] text-slate-400">Sıralama</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-300">
              #{summary.placement} / {summary.totalCombatants}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Eliminasyon</div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {summary.kills} <span className="text-xs text-rose-400">({summary.headshots} HC)</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Verilen Hasar</div>
            <div className="font-mono-tabular text-lg font-bold text-cyan-300">
              {summary.damageDealt}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Hayatta Kalma</div>
            <div className="font-mono-tabular text-lg font-bold text-emerald-300">
              {summary.survivalSeconds} sn
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Tekrar Oyna</span>
          </button>
          <button
            type="button"
            onClick={onReturnToLobby}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>Lobiye Dön</span>
          </button>
        </div>
      </div>
    </div>
  );
};
