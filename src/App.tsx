import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { GameHud } from './components/GameHud';
import { HudSettingsModal } from './components/HudSettingsModal';
import { MatchEndModal } from './components/MatchEndModal';
import { PauseModal } from './components/PauseModal';
import { TitleLobbyOverlay } from './components/TitleLobbyOverlay';
import { ArenaEngine } from './game/engine';
import { DEFAULT_GAME_CONFIG, sanitizeGameConfig } from './shared/constants';
import {
  getGameFirebase,
  handleFirestoreError,
  OperationType,
} from './shared/firebaseCore';
import { loadHudSettings, saveHudSettings } from './shared/hudLayout';
import type {
  GameConfig,
  GameHudSnapshot,
  HudSettings,
  MatchSummary,
  PlayerProfile,
} from './shared/types';

const INITIAL_HUD: GameHudSnapshot = {
  hp: 100,
  maxHp: 100,
  shield: 50,
  maxShield: 50,
  jetpackFuel: 100,
  grenades: 4,
  maxGrenades: 8,
  aliveCount: 30,
  totalCount: 30,
  kills: 0,
  headshots: 0,
  damageDealt: 0,
  survivalSeconds: 0,
  weaponSlot: 1,
  ammoInMag: 30,
  magSize: 30,
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  currentFloor: 1,
  currentRoom: 'Nakil Uçağı',
  zoneRadius: 260,
  outsideZone: false,
  zoneDps: 0,
  playerX: 0,
  playerY: 148,
  playerZ: 0,
  playerYaw: Math.PI,
  dropPhase: 'plane',
  altitude: 148,
  parachuteOpen: false,
  planeProgress: 0,
  planeStartX: -235,
  planeStartZ: -220,
  planeEndX: 235,
  planeEndZ: 220,
  inVehicle: false,
  vehicleName: '',
  vehicleSpeedKmh: 0,
  vehicleHp: 0,
  vehicleMaxHp: 300,
  nearbyVehicleName: null,
  houses: [],
  blips: [],
  hitMarker: 'none',
  headCatBannerUntil: 0,
  headCatVictim: '',
  killFeed: [],
};

export default function App() {
  const { auth, db, googleProvider } = getGameFirebase();

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const [phase, setPhase] = useState<'lobby' | 'playing' | 'paused' | 'ended'>('lobby');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [hud, setHud] = useState<GameHudSnapshot>(INITIAL_HUD);
  const [hudSettings, setHudSettings] = useState<HudSettings>(() => loadHudSettings());
  const [hudModalOpen, setHudModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const recordMatchStats = useCallback(
    async (summary: MatchSummary) => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const path = `players/${currentUser.uid}`;
      try {
        await updateDoc(doc(db, 'players', currentUser.uid), {
          wins: increment(summary.outcome === 'victory' ? 1 : 0),
          kills: increment(Math.min(35, Math.max(0, summary.kills))),
          headshots: increment(Math.min(35, Math.max(0, summary.headshots))),
          matchesPlayed: increment(1),
          totalDamage: increment(Math.min(25000, Math.max(0, summary.damageDealt))),
          online: true,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        // Non-fatal if player was kicked/banned mid-match; log structured details
        console.warn('Match stat update failed:', error, path);
      }
    },
    [db]
  );

  // Mount Three.js ArenaEngine once in isolated container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new ArenaEngine(mount, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onMatchEnd: (summary) => {
        setMatchSummary(summary);
        setPhase('ended');
        void recordMatchStats(summary);
      },
      onPauseRequest: () => {
        if (phaseRef.current === 'playing') {
          engine.setPaused(true);
          setPhase('paused');
        }
      },
      onMuteToggle: (m) => setMuted(m),
      onContextLost: () => setWebglLost(true),
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [recordMatchStats]);

  // Listen to live game_config/live from Firestore
  useEffect(() => {
    const configRef = doc(db, 'game_config', 'live');
    const unsub = onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          const next = sanitizeGameConfig(snap.data() as Partial<GameConfig>);
          setGameConfig(next);
          engineRef.current?.updateLiveConfig(next);
          if (next.maintenanceMode && phaseRef.current !== 'lobby') {
            engineRef.current?.returnToLobby();
            setPhase('lobby');
          }
        }
      },
      (error) => {
        console.warn('game_config/live listener notice:', error.message);
      }
    );
    return () => unsub();
  }, [db]);

  // Firebase Auth listener + Player Profile sync
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (nextUser) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }
      setUser(nextUser);
      if (!nextUser) {
        setPlayerProfile(null);
        if (phaseRef.current !== 'lobby') {
          engineRef.current?.returnToLobby();
          setPhase('lobby');
        }
        return;
      }

      const playerRef = doc(db, 'players', nextUser.uid);
      const path = `players/${nextUser.uid}`;
      try {
        const snap = await getDoc(playerRef);
        const cleanName = (nextUser.displayName || nextUser.email?.split('@')[0] || 'Oyuncu').slice(0, 80);
        const cleanEmail = (nextUser.email || '').slice(0, 160);
        const cleanPhoto = (nextUser.photoURL || '').slice(0, 500);

        if (!snap.exists()) {
          await setDoc(playerRef, {
            uid: nextUser.uid,
            displayName: cleanName,
            email: cleanEmail,
            photoURL: cleanPhoto,
            status: 'active',
            muted: false,
            kickReason: '',
            banReason: '',
            online: true,
            wins: 0,
            kills: 0,
            headshots: 0,
            matchesPlayed: 0,
            totalDamage: 0,
            lastSeen: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const existingData = snap.data() as PlayerProfile;
          if (existingData.status !== 'banned') {
            await updateDoc(playerRef, {
              displayName: cleanName,
              photoURL: cleanPhoto,
              online: true,
              lastSeen: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path, auth);
      }

      profileUnsub = onSnapshot(
        playerRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const prof = docSnap.data() as PlayerProfile;
            setPlayerProfile(prof);
            if (
              (prof.status === 'banned' || prof.status === 'kicked') &&
              phaseRef.current !== 'lobby'
            ) {
              engineRef.current?.returnToLobby();
              setPhase('lobby');
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path, auth);
        }
      );
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [auth, db]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google girişi tamamlanamadı.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'players', user.uid), {
          online: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore if banned or offline
      }
    }
    await signOut(auth);
  };

  const handleAcknowledgeKick = async () => {
    if (!user) return;
    const path = `players/${user.uid}`;
    try {
      await updateDoc(doc(db, 'players', user.uid), {
        status: 'active',
        kickReason: '',
        online: true,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path, auth);
    }
  };

  const handleStartMatch = () => {
    if (!user || gameConfig.maintenanceMode) return;
    if (playerProfile?.status === 'banned' || playerProfile?.status === 'kicked') return;
    setMatchSummary(null);
    engineRef.current?.updateLiveConfig(gameConfig);
    engineRef.current?.startMatch();
    setPhase('playing');
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  const handleSaveHud = (next: HudSettings) => {
    const saved = saveHudSettings(next);
    setHudSettings(saved);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0f14]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full"
        aria-label="APEX DROP 30 3D Villa Arenası"
      />

      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center text-slate-200">
          <div>
            <h2 className="font-display text-xl font-bold text-amber-400">
              WebGL Bağlantısı Kesildi
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              3D sahneyi yeniden başlatmak için sayfayı yenileyin.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
            >
              Yenile
            </button>
          </div>
        </div>
      )}

      {phase === 'lobby' && (
        <TitleLobbyOverlay
          user={user}
          authLoading={authLoading}
          authError={authError}
          playerProfile={playerProfile}
          gameConfig={gameConfig}
          muted={muted}
          onToggleMute={handleToggleMute}
          onGoogleLogin={handleGoogleLogin}
          onLogout={handleLogout}
          onStartMatch={handleStartMatch}
          onOpenHudSettings={() => setHudModalOpen(true)}
          onAcknowledgeKick={handleAcknowledgeKick}
        />
      )}

      {phase === 'playing' && (
        <GameHud
          hud={hud}
          hudSettings={hudSettings}
          gameConfig={gameConfig}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={() => {
            engineRef.current?.setPaused(true);
            setPhase('paused');
          }}
          onSelectWeapon={(slot) => engineRef.current?.equipWeapon(slot)}
          onReload={() => engineRef.current?.triggerReload()}
          onJoystick={(x, y) => engineRef.current?.setJoystickInput(x, y)}
          onLookDelta={(dx, dy) => engineRef.current?.addLookDelta(dx, dy)}
          onTouchFire={(firing, ads) => engineRef.current?.setTouchFire(firing, ads)}
          onTouchJump={(pressed) => engineRef.current?.setTouchJump(pressed)}
          onPlaneJump={() => engineRef.current?.triggerPlaneJump()}
          onParachuteOpen={() => engineRef.current?.triggerParachuteOpen()}
          onToggleVehicle={() => engineRef.current?.toggleVehicle()}
          onThrowBomb={() => engineRef.current?.throwBomb()}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          muted={muted}
          onResume={() => {
            engineRef.current?.setPaused(false);
            setPhase('playing');
          }}
          onOpenHudSettings={() => setHudModalOpen(true)}
          onToggleMute={handleToggleMute}
          onReturnToLobby={() => {
            engineRef.current?.returnToLobby();
            setPhase('lobby');
          }}
        />
      )}

      {phase === 'ended' && matchSummary && (
        <MatchEndModal
          summary={matchSummary}
          onPlayAgain={handleStartMatch}
          onReturnToLobby={() => {
            engineRef.current?.returnToLobby();
            setMatchSummary(null);
            setPhase('lobby');
          }}
        />
      )}

      {hudModalOpen && (
        <HudSettingsModal
          settings={hudSettings}
          onSave={handleSaveHud}
          onClose={() => setHudModalOpen(false)}
        />
      )}
    </div>
  );
}
