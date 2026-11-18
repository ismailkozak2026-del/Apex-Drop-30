import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Activity,
  Ban,
  CheckCircle2,
  FileText,
  Gamepad2,
  LogIn,
  LogOut,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_GAME_CONFIG,
  isSuperAdminEmail,
  sanitizeGameConfig,
  SUPER_ADMIN_EMAIL,
} from '../shared/constants';
import {
  getKontrolFirebase,
  handleFirestoreError,
  OperationType,
} from '../shared/firebaseCore';
import { OfflineIndicator, PWAInstallButton } from '../shared/PWAWidgets';
import type {
  AdminActionType,
  AdminLogEntry,
  BotAggressionLevel,
  GameConfig,
  PlayerProfile,
} from '../shared/types';

type TabKey = 'players' | 'settings' | 'logs';
type PlayerFilter = 'all' | 'online' | 'active' | 'banned' | 'muted';

const ACTION_LABELS: Record<AdminActionType, string> = {
  kick: 'Odadan Atma',
  ban: 'Yasaklama',
  unban: 'Yasak Kaldırma',
  mute: 'Susturma',
  unmute: 'Susturma Kaldırma',
  reset_stats: 'Skor Sıfırlama',
  delete_player: 'Kayıt Silme',
  update_config: 'Ayar Güncelleme',
  reset_config: 'Varsayılana Dönüş',
};

function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    try {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('tr-TR');
    } catch {
      return '—';
    }
  }
  return '—';
}

export default function KontrolApp() {
  const { auth, db, googleProvider } = getKontrolFirebase();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('players');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [configDraft, setConfigDraft] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [configSaving, setConfigSaving] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [reasonModal, setReasonModal] = useState<{
    player: PlayerProfile;
    action: 'kick' | 'ban';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const [deleteConfirmPlayer, setDeleteConfirmPlayer] = useState<PlayerProfile | null>(null);

  // Isolated Google Auth state for kontrol-app
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && !isSuperAdminEmail(nextUser.email)) {
        const triedEmail = nextUser.email || 'bilinmeyen hesap';
        setAccessDeniedMessage(
          `Erişim Reddedildi (${triedEmail}): Bu kontrol uygulaması yalnızca yetkili süper yönetici (${SUPER_ADMIN_EMAIL}) içindir.`
        );
        await signOut(auth);
        setUser(null);
        setAuthReady(true);
        return;
      }
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, [auth]);

  const isAuthorized = Boolean(user && isSuperAdminEmail(user.email));

  // Subscribe to players, game_config/live, and admin_logs ONLY when super admin is authenticated
  useEffect(() => {
    if (!isAuthorized) {
      setPlayers([]);
      setLogs([]);
      setPlayersLoading(false);
      setLogsLoading(false);
      return;
    }

    setPlayersLoading(true);
    const unsubPlayers = onSnapshot(
      collection(db, 'players'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as PlayerProfile);
        list.sort((a, b) => Number(b.online) - Number(a.online) || b.kills - a.kills);
        setPlayers(list);
        setPlayersLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'players', auth);
      }
    );

    const unsubConfig = onSnapshot(
      doc(db, 'game_config', 'live'),
      (snap) => {
        if (snap.exists()) {
          setConfigDraft(sanitizeGameConfig(snap.data() as Partial<GameConfig>));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'game_config/live', auth);
      }
    );

    setLogsLoading(true);
    const unsubLogs = onSnapshot(
      query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdminLogEntry, 'id'>),
        }));
        setLogs(list);
        setLogsLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'admin_logs', auth);
      }
    );

    return () => {
      unsubPlayers();
      unsubConfig();
      unsubLogs();
    };
  }, [auth, db, isAuthorized]);

  const writeAuditLog = async (
    action: AdminActionType,
    targetUid: string,
    targetName: string,
    reason: string,
    details: string
  ) => {
    if (!user?.email) return;
    try {
      await addDoc(collection(db, 'admin_logs'), {
        action,
        targetUid: targetUid.slice(0, 128),
        targetName: targetName.slice(0, 120),
        reason: reason.slice(0, 300),
        details: details.slice(0, 500),
        adminEmail: user.email,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'admin_logs', auth);
    }
  };

  const handleGoogleSignIn = async () => {
    setAccessDeniedMessage(null);
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!isSuperAdminEmail(cred.user.email)) {
        setAccessDeniedMessage(
          `Erişim Reddedildi (${cred.user.email || 'bilinmeyen hesap'}): Bu kontrol uygulaması yalnızca ${SUPER_ADMIN_EMAIL} hesabına açıktır.`
        );
        await signOut(auth);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google girişi başarısız oldu.';
      setAccessDeniedMessage(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return players.filter((p) => {
      if (playerFilter === 'online' && !p.online) return false;
      if (playerFilter === 'active' && p.status !== 'active') return false;
      if (playerFilter === 'banned' && p.status !== 'banned') return false;
      if (playerFilter === 'muted' && !p.muted) return false;
      if (q) {
        const hay = `${p.displayName} ${p.email} ${p.uid}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [players, playerFilter, searchTerm]);

  const handleConfirmReasonAction = async () => {
    if (!reasonModal) return;
    const { player, action } = reasonModal;
    const cleanReason = (reasonText.trim() || 'Yönetici işlemi').slice(0, 200);
    const path = `players/${player.uid}`;
    try {
      if (action === 'kick') {
        await updateDoc(doc(db, 'players', player.uid), {
          status: 'kicked',
          kickReason: cleanReason,
          online: false,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog('kick', player.uid, player.displayName, cleanReason, 'Oyuncu odadan atıldı');
      } else {
        await updateDoc(doc(db, 'players', player.uid), {
          status: 'banned',
          banReason: cleanReason,
          online: false,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog('ban', player.uid, player.displayName, cleanReason, 'Oyuncu yasaklandı');
      }
      setReasonModal(null);
      setReasonText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path, auth);
    }
  };

  const handleUnban = async (player: PlayerProfile) => {
    const path = `players/${player.uid}`;
    try {
      await updateDoc(doc(db, 'players', player.uid), {
        status: 'active',
        banReason: '',
        kickReason: '',
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog('unban', player.uid, player.displayName, 'Yasak kaldırıldı', 'Durum active yapıldı');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path, auth);
    }
  };

  const handleToggleMute = async (player: PlayerProfile) => {
    const nextMuted = !player.muted;
    const path = `players/${player.uid}`;
    try {
      await updateDoc(doc(db, 'players', player.uid), {
        muted: nextMuted,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        nextMuted ? 'mute' : 'unmute',
        player.uid,
        player.displayName,
        nextMuted ? 'Susturma uygulandı' : 'Susturma kaldırıldı',
        `muted=${String(nextMuted)}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path, auth);
    }
  };

  const handleResetStats = async (player: PlayerProfile) => {
    const path = `players/${player.uid}`;
    try {
      await updateDoc(doc(db, 'players', player.uid), {
        wins: 0,
        kills: 0,
        headshots: 0,
        matchesPlayed: 0,
        totalDamage: 0,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'reset_stats',
        player.uid,
        player.displayName,
        'Skorlar sıfırlandı',
        'wins/kills/headshots/matchesPlayed/totalDamage = 0'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path, auth);
    }
  };

  const handleDeletePlayer = async () => {
    if (!deleteConfirmPlayer) return;
    const p = deleteConfirmPlayer;
    const path = `players/${p.uid}`;
    try {
      await deleteDoc(doc(db, 'players', p.uid));
      await writeAuditLog('delete_player', p.uid, p.displayName, 'Kayıt kalıcı silindi', p.email);
      setDeleteConfirmPlayer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path, auth);
    }
  };

  const handlePublishConfig = async (cfg: GameConfig, isReset = false) => {
    if (!user?.email) return;
    setConfigSaving(true);
    setConfigFeedback(null);
    const clean = sanitizeGameConfig(cfg);
    try {
      await setDoc(doc(db, 'game_config', 'live'), {
        ...clean,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });
      await writeAuditLog(
        isReset ? 'reset_config' : 'update_config',
        'live',
        'game_config/live',
        isReset ? 'Varsayılan ayarlara dönüldü' : 'Canlı oyun ayarları yayınlandı',
        `HP=${clean.startingHp}, Kalkan=${clean.startingShield}, Hız=${clean.zoneShrinkSpeed}x, Bot=${clean.botAggression}`
      );
      setConfigDraft(clean);
      setConfigFeedback(
        isReset
          ? 'Varsayılan ayarlar ana oyuna canlı yayınlandı.'
          : 'Ayarlar başarıyla ana oyuna canlı yayınlandı.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'game_config/live', auth);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040d1a] text-slate-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-[#061326]/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/kontrol-icon.svg"
              alt="APEX DROP 30 KONTROL"
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-display text-lg font-bold tracking-wider text-cyan-300 whitespace-nowrap">
              APEX DROP 30 KONTROL
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <OfflineIndicator />
            <PWAInstallButton label="KONTROLÜ KUR" accent="cyan" />

            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              <Gamepad2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Oyuna Git</span>
            </a>

            {isAuthorized && (
              <button
                type="button"
                onClick={() => signOut(auth)}
                data-testid="kontrol-logout-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/70 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Çıkış ({user?.email})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Auth Gate */}
        {!authReady ? (
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-8 text-center text-sm text-slate-300">
            Yönetici oturumu kontrol ediliyor...
          </div>
        ) : !isAuthorized ? (
          <div
            data-testid="kontrol-auth-gate"
            className="mx-auto mt-10 max-w-lg rounded-xl border border-cyan-500/30 bg-[#081930] p-6 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-cyan-400" />
              <div>
                <h1 className="font-display text-xl font-bold text-white">
                  Bağımsız Yönetici Girişi
                </h1>
                <p className="text-xs text-slate-400">
                  Ana oyundan izole oturum · Yalnızca süper yönetici erişimi
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Bu konsola yalnızca yetkili süper yönetici Gmail hesabı (
              <span className="font-mono-tabular font-semibold text-cyan-300">
                {SUPER_ADMIN_EMAIL}
              </span>
              ) ile giriş yapılabilir.
            </p>

            {accessDeniedMessage && (
              <div
                data-testid="kontrol-access-denied"
                className="mt-4 rounded-lg border border-rose-500/60 bg-rose-950/90 p-3.5 text-xs font-medium text-rose-200"
              >
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Yetkisiz Hesap Uyarısı</span>
                </div>
                <p className="mt-1">{accessDeniedMessage}</p>
              </div>
            )}

            <button
              type="button"
              disabled={authLoading}
              onClick={handleGoogleSignIn}
              data-testid="kontrol-google-login-btn"
              className="mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>{authLoading ? 'Doğrulanıyor...' : 'GOOGLE İLE YÖNETİCİ GİRİŞİ YAP'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 3 Tabs */}
            <nav className="flex flex-wrap items-center gap-2 border-b border-cyan-500/20 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('players')}
                data-testid="tab-players"
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'players'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Oyuncular ({players.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                data-testid="tab-settings"
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Settings2 className="h-4 w-4" />
                <span>Ana Oyun Ayarları</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                data-testid="tab-logs"
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Denetim Günlüğü ({logs.length})</span>
              </button>
            </nav>

            {/* TAB 1: OYUNCULAR */}
            {activeTab === 'players' && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        ['all', 'Tümü'],
                        ['online', 'Çevrimiçi'],
                        ['active', 'Aktif'],
                        ['banned', 'Yasaklı'],
                        ['muted', 'Susturulmuş'],
                      ] as Array<[PlayerFilter, string]>
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlayerFilter(key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          playerFilter === key
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Oyuncu, e-posta veya UID ara..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {playersLoading ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
                    Oyuncu listesi yükleniyor...
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
                    Seçili filtreye uygun kayıtlı oyuncu bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPlayers.map((p) => (
                      <div
                        key={p.uid}
                        className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-[#081526] p-4 lg:flex-row lg:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                            <span>{p.displayName}</span>
                            <span className="text-xs font-normal text-slate-400">
                              {p.online ? 'Çevrimiçi' : 'Çevrimdışı'} ·{' '}
                              {p.status === 'banned'
                                ? 'Yasaklı'
                                : p.status === 'kicked'
                                  ? 'Odadan Atıldı'
                                  : 'Aktif'}
                              {p.muted ? ' · Susturulmuş' : ''}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {p.email} · <span className="font-mono-tabular">{p.uid}</span>
                          </div>
                          <div className="font-mono-tabular text-xs text-cyan-300">
                            {p.wins} Zafer · {p.kills} Eleme · {p.headshots} HC · {p.matchesPlayed} Maç · {p.totalDamage} Hasar
                          </div>
                          {(p.banReason || p.kickReason) && (
                            <div className="text-xs text-amber-300">
                              Not: {p.banReason || p.kickReason}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReasonModal({ player: p, action: 'kick' });
                              setReasonText('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900 cursor-pointer"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Odadan At</span>
                          </button>

                          {p.status === 'banned' ? (
                            <button
                              type="button"
                              onClick={() => handleUnban(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Yasağı Kaldır</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReasonModal({ player: p, action: 'ban' });
                                setReasonText('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900 cursor-pointer"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span>Yasakla</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleMute(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                          >
                            {p.muted ? (
                              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            <span>{p.muted ? 'Susturmayı Kaldır' : 'Sustur'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetStats(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Skor Sıfırla</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPlayer(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-600/50 bg-rose-950/80 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Kaydı Sil</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: ANA OYUN AYARLARI */}
            {activeTab === 'settings' && (
              <section className="space-y-6 rounded-xl border border-slate-800 bg-[#081526] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-cyan-300">
                      Canlı Oyun Kuralları & Duyuru Kontrolü
                    </h2>
                    <p className="text-xs text-slate-400">
                      game_config/live belgesinden tüm aktif oyun istemcilerine anında yayınlanır.
                    </p>
                  </div>
                  <Activity className="h-5 w-5 text-cyan-400" />
                </div>

                {configFeedback && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-4 py-2.5 text-xs font-semibold text-emerald-200">
                    {configFeedback}
                  </div>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Toggles */}
                  <div className="space-y-4">
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">Bakım Modu</div>
                        <div className="text-xs text-slate-400">
                          Açıkken oyuncular arenaya inemez.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={configDraft.maintenanceMode}
                        onChange={(e) =>
                          setConfigDraft((s) => ({ ...s, maintenanceMode: e.target.checked }))
                        }
                        className="h-5 w-5 accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">2 Vuruşta Ölüm Kuralı</div>
                        <div className="text-xs text-slate-400">
                          Aynı hedefte 2. isabetli vuruşta anında eleme.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={configDraft.twoShotKillEnabled}
                        onChange={(e) =>
                          setConfigDraft((s) => ({ ...s, twoShotKillEnabled: e.target.checked }))
                        }
                        className="h-5 w-5 accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">
                          Kafadan Tek + HEAD CAT
                        </div>
                        <div className="text-xs text-slate-400">
                          Kafadan vuruşta tek kurşunda eleme ve bildirim bandı.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={configDraft.headshotInstantKillEnabled}
                        onChange={(e) =>
                          setConfigDraft((s) => ({
                            ...s,
                            headshotInstantKillEnabled: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">
                          Çift Zıplama & Jetpack Süzülme
                        </div>
                        <div className="text-xs text-slate-400">
                          Havada çift zıplama ve jetpack yakıtlı süzülme.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={configDraft.doubleJumpJetpackEnabled}
                        onChange={(e) =>
                          setConfigDraft((s) => ({
                            ...s,
                            doubleJumpJetpackEnabled: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 accent-cyan-500"
                      />
                    </label>
                  </div>

                  {/* Sliders & Text Inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300">
                        Bakım Mesajı
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={configDraft.maintenanceMessage}
                        onChange={(e) =>
                          setConfigDraft((s) => ({ ...s, maintenanceMessage: e.target.value }))
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300">
                        Canlı Oyun İçi Duyuru Bandı
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        placeholder="Boş bırakılırsa gizlenir..."
                        value={configDraft.announcement}
                        onChange={(e) =>
                          setConfigDraft((s) => ({ ...s, announcement: e.target.value }))
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Başlangıç Canı (HP)</span>
                          <span className="font-mono-tabular text-cyan-300">
                            {configDraft.startingHp} HP
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={300}
                          step={10}
                          value={configDraft.startingHp}
                          onChange={(e) =>
                            setConfigDraft((s) => ({ ...s, startingHp: Number(e.target.value) }))
                          }
                          className="mt-1 w-full accent-cyan-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Başlangıç Kalkanı</span>
                          <span className="font-mono-tabular text-cyan-300">
                            {configDraft.startingShield}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={10}
                          value={configDraft.startingShield}
                          onChange={(e) =>
                            setConfigDraft((s) => ({
                              ...s,
                              startingShield: Number(e.target.value),
                            }))
                          }
                          className="mt-1 w-full accent-cyan-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Bölge Daralma Hızı</span>
                          <span className="font-mono-tabular text-cyan-300">
                            {configDraft.zoneShrinkSpeed.toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.3}
                          max={3.0}
                          step={0.1}
                          value={configDraft.zoneShrinkSpeed}
                          onChange={(e) =>
                            setConfigDraft((s) => ({
                              ...s,
                              zoneShrinkSpeed: Number(e.target.value),
                            }))
                          }
                          className="mt-1 w-full accent-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-300">
                        Bot Saldırganlık Seviyesi
                      </span>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {(
                          [
                            ['low', 'Düşük'],
                            ['normal', 'Normal'],
                            ['hard', 'Zor'],
                          ] as Array<[BotAggressionLevel, string]>
                        ).map(([lvl, label]) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() =>
                              setConfigDraft((s) => ({ ...s, botAggression: lvl }))
                            }
                            className={`rounded-lg py-2 text-xs font-bold cursor-pointer ${
                              configDraft.botAggression === lvl
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    disabled={configSaving}
                    onClick={() => handlePublishConfig(DEFAULT_GAME_CONFIG, true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Varsayılana Dön</span>
                  </button>

                  <button
                    type="button"
                    disabled={configSaving}
                    onClick={() => handlePublishConfig(configDraft, false)}
                    data-testid="publish-config-btn"
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{configSaving ? 'Yayınlanıyor...' : 'Ayarları Canlı Yayınla'}</span>
                  </button>
                </div>
              </section>
            )}

            {/* TAB 3: DENETİM GÜNLÜĞÜ */}
            {activeTab === 'logs' && (
              <section className="space-y-3">
                {logsLoading ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
                    Denetim kayıtları yükleniyor...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
                    Henüz kaydedilmiş yönetici işlemi bulunmuyor.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#081526]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Zaman</th>
                          <th className="px-4 py-3 font-semibold">İşlem</th>
                          <th className="px-4 py-3 font-semibold">Hedef</th>
                          <th className="px-4 py-3 font-semibold">Sebep / Detay</th>
                          <th className="px-4 py-3 font-semibold">Yönetici</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/50">
                            <td className="font-mono-tabular whitespace-nowrap px-4 py-3 text-slate-400">
                              {formatTimestamp(log.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-cyan-300">
                              {ACTION_LABELS[log.action] || log.action}
                            </td>
                            <td className="px-4 py-3 font-semibold text-white">
                              {log.targetName}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {log.reason}
                              {log.details ? ` · ${log.details}` : ''}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{log.adminEmail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Kick / Ban Reason Modal */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
            <h3 className="font-display text-lg font-bold text-white">
              {reasonModal.action === 'kick' ? 'Oyuncuyu Odadan At' : 'Oyuncuyu Yasakla'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Hedef: <span className="font-semibold text-white">{reasonModal.player.displayName}</span>
            </p>
            <input
              type="text"
              maxLength={200}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="İşlem sebebini yazın..."
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmReasonAction}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
              >
                Onayla ve Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Player Confirmation Modal */}
      {deleteConfirmPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-rose-500/40 bg-slate-900 p-5 text-slate-100">
            <h3 className="font-display text-lg font-bold text-rose-400">
              Oyuncu Kaydını Kalıcı Sil
            </h3>
            <p className="mt-2 text-xs text-slate-300">
              <strong>{deleteConfirmPlayer.displayName}</strong> ({deleteConfirmPlayer.email})
              kaydı Firestore üzerinden kalıcı olarak silinecektir.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlayer(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeletePlayer}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
              >
                Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
