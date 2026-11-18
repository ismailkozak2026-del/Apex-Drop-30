import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from './pwa';

interface PWAInstallButtonProps {
  label: string;
  accent?: 'amber' | 'cyan';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  label,
  accent = 'amber',
  className = '',
}) => {
  const { canPromptInstall, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      const outcome = await install();
      if (outcome !== 'unavailable') return;
    }
    setShowGuide(true);
  };

  const accentStyle =
    accent === 'cyan'
      ? 'border-cyan-500/40 bg-cyan-950/80 text-cyan-100 hover:bg-cyan-900/90'
      : 'border-amber-500/40 bg-zinc-900/90 text-amber-200 hover:bg-zinc-800';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="pwa-install-btn"
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer ${accentStyle} ${className}`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-5 w-5 text-amber-400 shrink-0" />
                <h3 className="font-display text-lg font-bold tracking-wide">
                  Cihaza Kurulum (PWA / APK Deneyimi)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>iPhone / iPad Safari üzerinde kurmak için:</p>
                <p>
                  1. Alt veya üst araç çubuğundaki <strong>Paylaş</strong> simgesine dokunun.
                </p>
                <p>
                  2. Listeden <strong>Ana Ekrana Ekle</strong> seçeneğine dokunup onaylayın.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>Chrome veya Android cihazınıza tam ekran uygulama olarak kurmak için:</p>
                <p>
                  1. Tarayıcı adres çubuğunun sağındaki <strong>Yükle</strong> simgesine veya sağ üst menüye (⋮) dokunun.
                </p>
                <p>
                  2. <strong>Uygulamayı Yükle</strong> / <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      data-testid="offline-indicator"
      className={`inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-950/95 px-3 py-1.5 text-xs font-semibold text-amber-200 ${className}`}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Çevrimdışı Mod · Önbellek kullanılıyor</span>
    </div>
  );
};
