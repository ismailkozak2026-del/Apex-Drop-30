import React from 'react';
import {
  AlertTriangle,
  LogIn,
  LogOut,
  Play,
  ShieldAlert,
  Sliders,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { isSuperAdminEmail } from '../shared/constants';
import { OfflineIndicator, PWAInstallButton } from '../shared/PWAWidgets';
import type { GameConfig, PlayerProfile } from '../shared/types';

interface TitleLobbyOverlayProps {
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null;
  authLoading: boolean;
  authError: string | null;
  playerProfile: PlayerProfile | null;
  gameConfig: GameConfig;
  muted: boolean;
  onToggleMute: () => void;
  onGoogleLogin: () => void;
  onLogout: () => void;
  onStartMatch: () => void;
  onOpenHudSettings: () => void;
  onAcknowledgeKick: () => void;
}

export const TitleLobbyOverlay: React.FC<TitleLobbyOverlayProps> = ({
  user,
  authLoading,
  authError,
  playerProfile,
  gameConfig,
  muted,
  onToggleMute,
  onGoogleLogin,
  onLogout,
  onStartMatch,
  onOpenHudSettings,
  onAcknowledgeKick,
}) => {
  const isAdmin = isSuperAdminEmail(user?.email);
  const isBanned = playerProfile?.status === 'banned';
  const isKicked = playerProfile?.status === 'kicked';
  const canDeploy = Boolean(user) && !gameConfig.maintenanceMode && !isBanned && !isKicked;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between bg-gradient-to-r from-[#090c12]/85 via-[#090c12]/40 to-transparent p-4 sm:p-6">
      {/* Top Row: Live Announcement + Right Action Cluster */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <OfflineIndicator />
          {gameConfig.announcement.trim().length > 0 && (
            <div
              data-testid="live-announcement"
              className="max-w-md rounded-lg border border-amber-400/50 bg-amber-950/90 px-3.5 py-2 text-xs font-semibold text-amber-100 shadow-lg"
            >
              DUYURU: {gameConfig.announcement}
            </div>
          )}
        </div>

        {/* Top-Right: Sound, PWA Install, Hud Settings, Profile Card, Admin Link */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <PWAInstallButton
            label="UYGULAMAYI YÜKLE / TELEFONA KUR / APK"
            accent="amber"
          />

          <button
            type="button"
            onClick={onOpenHudSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Sliders className="h-3.5 w-3.5 text-amber-400" />
            <span>HUD Düzeni</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
            <span>{muted ? 'Sessiz' : 'Ses Açık'}</span>
          </button>

          {user && (
            <div
              data-testid="player-profile-card"
              className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-1.5"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Oyuncu'}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full border border-amber-400/50 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">
                  {(user.displayName || 'O')[0]}
                </div>
              )}
              <div className="leading-tight">
                <div className="max-w-[130px] truncate text-xs font-bold text-white">
                  {user.displayName || 'Oyuncu'}
                </div>
                <div className="font-mono-tabular text-[11px] text-amber-300">
                  {playerProfile?.wins ?? 0} Zafer · {playerProfile?.kills ?? 0} Eleme
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Çıkış Yap"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {isAdmin && (
            <a
              href="/kontrol"
              data-testid="admin-kontrol-link"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-950/90 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-900 whitespace-nowrap"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>KONTROL UYGULAMASI</span>
            </a>
          )}
        </div>
      </div>

      {/* Left-Center Hero Lockup over Calm Negative Space */}
      <div className="pointer-events-auto my-auto max-w-lg space-y-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-400">
            560×560M DEV AÇIK ARENA · 30 KİŞİLİK BATTLE ROYALE
          </p>

          {/* Bespoke Inline SVG Title Lockup */}
          <svg
            viewBox="0 0 420 84"
            className="mt-2 h-16 w-auto sm:h-20"
            aria-label="APEX DROP 30"
          >
            <defs>
              <linearGradient id="apexTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="68%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path
              d="M6 12 L24 12 L16 28 L6 28 Z"
              fill="#ef4444"
            />
            <text
              x="34"
              y="56"
              fill="url(#apexTitleGrad)"
              fontFamily="Chakra Petch, sans-serif"
              fontSize="48"
              fontWeight="700"
              letterSpacing="2"
            >
              APEX DROP 30
            </text>
            <line x1="34" y1="68" x2="340" y2="68" stroke="#f59e0b" strokeWidth="3" />
          </svg>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
            Uçaktan istediğin yere paraşütle atla; 18 bağımsız ev ve 2 katlı Merkez Villa
            arasında arabalarla dolaş, 15 silah ve el bombasıyla 29 rakibi ele.
          </p>
        </div>

        {/* Maintenance / Ban / Kick Alerts */}
        {gameConfig.maintenanceMode && (
          <div
            data-testid="maintenance-banner"
            className="rounded-lg border border-amber-500/60 bg-amber-950/90 p-3.5 text-sm text-amber-100"
          >
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Bakım Modu Aktif</span>
            </div>
            <p className="mt-1 text-xs text-amber-100/90">
              {gameConfig.maintenanceMessage}
            </p>
          </div>
        )}

        {isBanned && (
          <div className="rounded-lg border border-rose-500/70 bg-rose-950/95 p-4 text-sm text-rose-100">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Hesabınız Arena Dışına Yasaklandı</span>
            </div>
            <p className="mt-1 text-xs text-rose-200">
              Sebep: {playerProfile?.banReason || 'Yönetici kararı'}
            </p>
          </div>
        )}

        {isKicked && !isBanned && (
          <div className="rounded-lg border border-amber-500/70 bg-slate-900/95 p-4 text-sm text-amber-100">
            <div className="font-bold text-amber-300">Odadan Çıkarıldınız</div>
            <p className="mt-1 text-xs text-slate-300">
              Sebep: {playerProfile?.kickReason || 'Yönetici uyarısı'}
            </p>
            <button
              type="button"
              onClick={onAcknowledgeKick}
              className="mt-3 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              Onayla ve Devam Et
            </button>
          </div>
        )}

        {authError && (
          <div className="rounded-lg border border-rose-500/50 bg-rose-950/90 px-3.5 py-2 text-xs text-rose-200">
            {authError}
          </div>
        )}

        {/* Primary Auth + Start CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {!user && (
            <button
              type="button"
              disabled={authLoading}
              onClick={onGoogleLogin}
              data-testid="google-login-btn"
              className="inline-flex items-center gap-2.5 rounded-lg border border-white/20 bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>{authLoading ? 'Bağlanıyor...' : 'GOOGLE İLE GİRİŞ YAP'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!canDeploy}
            onClick={onStartMatch}
            data-testid="enter-arena-btn"
            className="inline-flex items-center gap-2.5 rounded-lg bg-amber-500 px-6 py-3 font-display text-base font-bold tracking-wider text-slate-950 shadow-lg transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>ARENAYA İN</span>
          </button>
        </div>

        {!user && (
          <p className="text-xs font-medium text-amber-300/90">
            Maça başlamak için önce Google hesabınızla giriş yapmalısınız.
          </p>
        )}
      </div>

      {/* Bottom: Single Flat Control-Hint Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300/90">
        <span>
          WASD Hareket · Space Uçaktan Atla / Zıpla · F Araca Bin/İn · G Bomba At · R Şarjör · 1-9 / Q / E Silah · Esc Duraklat
        </span>
        <span className="font-mono-tabular text-slate-400">
          {gameConfig.twoShotKillEnabled ? '2 Vuruşta Eleme Aktif' : 'Klasik Hasar'} ·{' '}
          {gameConfig.headshotInstantKillEnabled ? 'Kafadan Tek (HEAD CAT)' : 'Normal Kritik'}
        </span>
      </div>
    </div>
  );
};
