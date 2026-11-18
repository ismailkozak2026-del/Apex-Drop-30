import React, { useRef, useState } from 'react';
import {
  Bomb,
  Car,
  Crosshair,
  Pause,
  Plane,
  RotateCw,
  Shield,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import type { GameConfig, GameHudSnapshot, HudSettings } from '../shared/types';
import { getWeaponBySlot, WEAPONS } from '../shared/weapons';
import { VillaMinimap } from './VillaMinimap';

interface GameHudProps {
  hud: GameHudSnapshot;
  hudSettings: HudSettings;
  gameConfig: GameConfig;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSelectWeapon: (slot: number) => void;
  onReload: () => void;
  onJoystick: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onTouchFire: (firing: boolean, ads?: boolean) => void;
  onTouchJump: (pressed: boolean) => void;
  onPlaneJump: () => void;
  onParachuteOpen: () => void;
  onToggleVehicle: () => void;
  onThrowBomb: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  hudSettings,
  gameConfig,
  muted,
  onToggleMute,
  onPause,
  onSelectWeapon,
  onReload,
  onJoystick,
  onLookDelta,
  onTouchFire,
  onTouchJump,
  onPlaneJump,
  onParachuteOpen,
  onToggleVehicle,
  onThrowBomb,
}) => {
  const [weaponDrawerOpen, setWeaponDrawerOpen] = useState(false);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const activeWeapon = getWeaponBySlot(hud.weaponSlot);
  const showHeadCat =
    Date.now() < hud.headCatBannerUntil || performance.now() < hud.headCatBannerUntil;
  const ctrl = hudSettings.controls;
  const onGround = hud.dropPhase === 'ground';

  const handleJoyStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyPointerId.current = e.pointerId;
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoy(e.clientX, e.clientY);
  };

  const updateJoy = (clientX: number, clientY: number) => {
    const maxR = 44;
    const dx = clientX - joyCenter.current.x;
    const dy = clientY - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const nx = dist > 0 ? (dx / dist) * (clamped / maxR) : 0;
    const ny = dist > 0 ? (dy / dist) * (clamped / maxR) : 0;
    setJoyOffset({ x: nx * maxR * 0.7, y: ny * maxR * 0.7 });
    onJoystick(nx, ny);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyOffset({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  return (
    <div
      data-testid="game-hud"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden select-none"
    >
      {/* Full-screen Swipe-to-Look Layer for touch */}
      <div
        className="pointer-events-auto absolute inset-0"
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') {
            lookPointerId.current = e.pointerId;
            lookLast.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onPointerMove={(e) => {
          if (lookPointerId.current === e.pointerId) {
            const dx = e.clientX - lookLast.current.x;
            const dy = e.clientY - lookLast.current.y;
            lookLast.current = { x: e.clientX, y: e.clientY };
            onLookDelta(dx, dy);
          }
        }}
        onPointerUp={(e) => {
          if (lookPointerId.current === e.pointerId) {
            lookPointerId.current = null;
          }
        }}
        onPointerCancel={() => {
          lookPointerId.current = null;
        }}
      />

      {/* Top Perimeter Clusters */}
      <div className="relative z-10 flex items-start justify-between p-3 sm:p-4">
        {/* Top-Left: Huge Island Radar + Location Name */}
        <div className="flex flex-col gap-1.5">
          <VillaMinimap
            playerX={hud.playerX}
            playerZ={hud.playerZ}
            playerYaw={hud.playerYaw}
            currentFloor={hud.currentFloor}
            zoneRadius={hud.zoneRadius}
            dropPhase={hud.dropPhase}
            inVehicle={hud.inVehicle}
            planeStartX={hud.planeStartX}
            planeStartZ={hud.planeStartZ}
            planeEndX={hud.planeEndX}
            planeEndZ={hud.planeEndZ}
            houses={hud.houses}
            blips={hud.blips}
          />
          <div className="rounded bg-slate-950/85 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
            {hud.currentRoom}
          </div>
        </div>

        {/* Top-Center: Alive / Kills / Zone + Plane/Parachute Prompt + HEAD CAT */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 rounded-lg border border-white/15 bg-slate-950/85 px-4 py-1.5 text-xs font-bold text-slate-100 tabular-nums">
            <span className="text-amber-400">
              KALAN: {hud.aliveCount}/{hud.totalCount}
            </span>
            <span className="text-slate-400">|</span>
            <span>ELEME: {hud.kills}</span>
            <span className="text-slate-400">|</span>
            <span className="text-cyan-300">BÖLGE: {hud.zoneRadius}m</span>
          </div>

          {gameConfig.announcement.trim().length > 0 && (
            <div className="rounded bg-amber-950/90 px-3 py-1 text-[11px] font-semibold text-amber-200 border border-amber-400/40">
              {gameConfig.announcement}
            </div>
          )}

          {hud.dropPhase === 'plane' && (
            <div
              data-testid="plane-drop-banner"
              className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border border-amber-400/70 bg-slate-950/95 px-5 py-3 text-center shadow-2xl"
            >
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-amber-300">
                <Plane className="h-4 w-4" />
                <span>NAKİL UÇAĞI · İSTEDİĞİN YERE ATLA ({hud.altitude}m)</span>
              </div>
              <div className="h-1.5 w-48 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{ width: `${Math.round(hud.planeProgress * 100)}%` }}
                />
              </div>
              <button
                type="button"
                data-testid="plane-jump-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlaneJump();
                }}
                className="rounded-lg bg-amber-500 px-5 py-2 font-display text-sm font-extrabold tracking-wider text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                ATLA (SPACE)
              </button>
            </div>
          )}

          {hud.dropPhase === 'parachute' && (
            <div
              data-testid="parachute-banner"
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-cyan-400/60 bg-slate-950/90 px-4 py-2 text-xs font-bold text-cyan-200 shadow-xl"
            >
              <Wind className="h-4 w-4 text-cyan-400" />
              <span className="font-mono-tabular">İRTİFA: {hud.altitude}m</span>
              <span className="text-slate-400">·</span>
              <span>
                {hud.parachuteOpen
                  ? 'Paraşüt Açık · WASD ile Yönlendir'
                  : 'Serbest Düşüş (42m Otomatik Açılır)'}
              </span>
              {!hud.parachuteOpen && (
                <button
                  type="button"
                  data-testid="open-parachute-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onParachuteOpen();
                  }}
                  className="rounded bg-cyan-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  PARAŞÜT AÇ (SPACE)
                </button>
              )}
            </div>
          )}

          {hud.outsideZone && (
            <div className="rounded border border-rose-500/70 bg-rose-950/95 px-3 py-1 text-xs font-bold text-rose-200">
              ENERJİ BÖLGESİ DIŞINDASIN · -{hud.zoneDps} HP/sn
            </div>
          )}

          {showHeadCat && (
            <div
              data-testid="head-cat-banner"
              className="flex items-center gap-2.5 rounded-lg border-2 border-rose-500 bg-slate-950/95 px-5 py-2 text-sm font-extrabold tracking-wider text-white shadow-xl"
            >
              <Crosshair className="h-5 w-5 text-rose-500" />
              <span className="font-display text-rose-400">HEAD CAT · TEK KURŞUN</span>
              {hud.headCatVictim && (
                <span className="text-xs font-semibold text-slate-300">
                  ({hud.headCatVictim})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: Mute / Pause + Kill Feed */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded-lg border border-white/15 bg-slate-950/85 p-2 text-slate-200 hover:bg-slate-800 cursor-pointer"
              aria-label="Ses"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onPause}
              data-testid="pause-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-slate-800 cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>DURAKLAT</span>
            </button>
          </div>

          <div className="flex flex-col items-end gap-1">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className="rounded bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-200"
              >
                <span className={kf.killerIsPlayer ? 'font-bold text-amber-400' : 'text-slate-200'}>
                  {kf.killerName}
                </span>{' '}
                <span className="text-slate-500">[{kf.weaponName}]</span>{' '}
                {kf.isHeadshot && <span className="font-bold text-rose-400">HC </span>}
                <span className={kf.victimIsPlayer ? 'font-bold text-rose-400' : 'text-slate-300'}>
                  {kf.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center Reticle + Hit Marker (Ground Combat Only) */}
      {onGround && !hud.inVehicle && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`relative flex items-center justify-center transition-transform duration-100 ${
              hud.isAds ? 'scale-75' : 'scale-100'
            }`}
          >
            <div className="h-1 w-1 rounded-full bg-white" />
            <div className="absolute -top-3 h-2 w-0.5 bg-white/80" />
            <div className="absolute -bottom-3 h-2 w-0.5 bg-white/80" />
            <div className="absolute -left-3 h-0.5 w-2 bg-white/80" />
            <div className="absolute -right-3 h-0.5 w-2 bg-white/80" />

            {hud.hitMarker !== 'none' && (
              <svg width="28" height="28" viewBox="0 0 28 28" className="absolute">
                <path
                  d="M4 4L10 10M24 4L18 10M4 24L10 18M24 24L18 18"
                  stroke={hud.hitMarker === 'head' ? '#ef4444' : '#ffffff'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Nearby Car Prompt OR Active Driving Speedometer */}
      {onGround && hud.nearbyVehicleName && !hud.inVehicle && (
        <div className="pointer-events-auto absolute bottom-36 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            data-testid="enter-vehicle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVehicle();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/70 bg-slate-950/95 px-4 py-2 text-xs font-extrabold text-cyan-200 shadow-xl hover:bg-slate-900 cursor-pointer"
          >
            <Car className="h-4 w-4 text-cyan-400" />
            <span>[F] ARACA BİN · {hud.nearbyVehicleName}</span>
          </button>
        </div>
      )}

      {onGround && hud.inVehicle && (
        <div className="pointer-events-auto absolute bottom-36 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-cyan-400/60 bg-slate-950/95 px-4 py-2 text-xs font-bold text-slate-100 shadow-xl">
          <Car className="h-4 w-4 text-cyan-400" />
          <span>{hud.vehicleName}</span>
          <span className="font-mono-tabular text-base font-extrabold text-amber-300">
            {hud.vehicleSpeedKmh} km/h
          </span>
          <div className="h-2 w-16 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{
                width: `${Math.min(100, (hud.vehicleHp / Math.max(1, hud.vehicleMaxHp)) * 100)}%`,
              }}
            />
          </div>
          <button
            type="button"
            data-testid="exit-vehicle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVehicle();
            }}
            className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-rose-500 cursor-pointer"
          >
            [F] İN
          </button>
        </div>
      )}

      {/* Status Bars (HP, Shield, Jetpack Fuel, Grenades, Ammo) */}
      <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-slate-950/90 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400">CAN</span>
          <div className="h-2.5 w-24 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-100"
              style={{ width: `${Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100)}%` }}
            />
          </div>
          <span className="font-mono-tabular text-xs font-bold text-white">{hud.hp}</span>
        </div>

        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          <div className="h-2.5 w-16 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-cyan-400 transition-all duration-100"
              style={{
                width: `${hud.maxShield > 0 ? Math.min(100, (hud.shield / hud.maxShield) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="font-mono-tabular text-xs font-bold text-cyan-200">{hud.shield}</span>
        </div>

        {gameConfig.doubleJumpJetpackEnabled && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <div className="h-2.5 w-12 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${hud.jetpackFuel}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 border-l border-slate-700 pl-3 font-mono-tabular text-xs font-bold text-orange-300">
          <Bomb className="h-3.5 w-3.5 text-orange-400" />
          <span>{hud.grenades}</span>
        </div>

        {onGround && !hud.inVehicle && (
          <div className="border-l border-slate-700 pl-3 font-mono-tabular text-xs font-bold text-amber-300">
            {hud.isReloading
              ? `ŞARJÖR %${Math.round(hud.reloadProgress * 100)}`
              : `${activeWeapon.name} · ${hud.ammoInMag}/${hud.magSize}`}
          </div>
        )}
      </div>

      {/* 1. Virtual Movement / Steering Joystick */}
      <div
        onPointerDown={handleJoyStart}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyEnd}
        onPointerCancel={handleJoyEnd}
        style={{
          left: `${ctrl.joystick.xPct}%`,
          top: `${ctrl.joystick.yPct}%`,
          transform: `translate(-50%, -50%) scale(${ctrl.joystick.scale})`,
        }}
        className="pointer-events-auto absolute z-20 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/25 bg-slate-950/60 touch-none"
      >
        <div className="pointer-events-none h-14 w-14 rounded-full border border-amber-400/35" />
        <div
          style={{ transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)` }}
          className="pointer-events-none absolute h-10 w-10 rounded-full bg-amber-400/85 shadow-lg"
        />
      </div>

      {/* 2. Main Fire Button (Ground Only) */}
      {onGround && !hud.inVehicle && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTouchFire(true, false);
          }}
          onPointerUp={() => onTouchFire(false, false)}
          onPointerCancel={() => onTouchFire(false, false)}
          style={{
            left: `${ctrl.fireMain.xPct}%`,
            top: `${ctrl.fireMain.yPct}%`,
            transform: `translate(-50%, -50%) scale(${ctrl.fireMain.scale})`,
          }}
          className="pointer-events-auto absolute z-20 flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400 bg-rose-600/85 text-[11px] font-extrabold text-white shadow-xl active:scale-95 cursor-pointer"
        >
          ATEŞ
        </button>
      )}

      {/* 3. ADS Fire Button (Ground Only) */}
      {onGround && !hud.inVehicle && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTouchFire(true, true);
          }}
          onPointerUp={() => onTouchFire(false, false)}
          onPointerCancel={() => onTouchFire(false, false)}
          style={{
            left: `${ctrl.fireAds.xPct}%`,
            top: `${ctrl.fireAds.yPct}%`,
            transform: `translate(-50%, -50%) scale(${ctrl.fireAds.scale})`,
          }}
          className="pointer-events-auto absolute z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-600/85 text-[10px] font-extrabold text-white shadow-xl active:scale-95 cursor-pointer"
        >
          NİŞAN
        </button>
      )}

      {/* 4. Jump / Parachute / Plane Drop Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onTouchJump(true);
        }}
        onPointerUp={() => onTouchJump(false)}
        onPointerCancel={() => onTouchJump(false)}
        style={{
          left: `${ctrl.jump.xPct}%`,
          top: `${ctrl.jump.yPct}%`,
          transform: `translate(-50%, -50%) scale(${ctrl.jump.scale})`,
        }}
        className="pointer-events-auto absolute z-20 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/70 bg-slate-900/85 text-[10px] font-bold text-cyan-200 cursor-pointer"
      >
        {hud.dropPhase === 'plane'
          ? 'ATLA'
          : hud.dropPhase === 'parachute'
            ? 'SÜZÜL'
            : hud.inVehicle
              ? 'FREN'
              : 'ZIPLA'}
      </button>

      {/* 5. Reload Button + Throw Bomb Action */}
      {onGround && !hud.inVehicle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReload();
          }}
          style={{
            left: `${ctrl.reload.xPct}%`,
            top: `${ctrl.reload.yPct}%`,
            transform: `translate(-50%, -50%) scale(${ctrl.reload.scale})`,
          }}
          className="pointer-events-auto absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border border-slate-400/60 bg-slate-900/85 text-slate-100 cursor-pointer"
          aria-label="Şarjör Değiştir"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      )}

      {onGround && (
        <button
          type="button"
          data-testid="throw-bomb-btn"
          disabled={hud.grenades <= 0}
          onClick={(e) => {
            e.stopPropagation();
            onThrowBomb();
          }}
          className="pointer-events-auto absolute bottom-20 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-orange-400/70 bg-orange-950/90 px-3 py-2 text-xs font-extrabold text-orange-200 shadow-lg hover:bg-orange-900 disabled:opacity-45 cursor-pointer"
        >
          <Bomb className="h-3.5 w-3.5 text-orange-400" />
          <span>[G] BOMBA ({hud.grenades})</span>
        </button>
      )}

      {/* 6. 15-Weapon Scrollable / Expandable Bar */}
      {onGround && !hud.inVehicle && (
        <div
          style={{
            left: `${ctrl.weaponBar.xPct}%`,
            top: `${ctrl.weaponBar.yPct}%`,
            transform: `translate(-50%, -50%) scale(${ctrl.weaponBar.scale})`,
          }}
          className="pointer-events-auto absolute z-20 flex max-w-[92vw] flex-col items-center gap-1.5"
        >
          {weaponDrawerOpen && (
            <div className="grid max-h-40 grid-cols-3 gap-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/95 p-2 sm:grid-cols-5">
              {WEAPONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onSelectWeapon(w.slot);
                    setWeaponDrawerOpen(false);
                  }}
                  className={`rounded px-2 py-1 text-left text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    hud.weaponSlot === w.slot
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {w.slot}. {w.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-white/15 bg-slate-950/90 px-2 py-1 max-w-[88vw]">
            <button
              type="button"
              onClick={() => setWeaponDrawerOpen((v) => !v)}
              className="rounded bg-slate-800 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-700 whitespace-nowrap cursor-pointer"
            >
              15 SİLAH {weaponDrawerOpen ? '▾' : '▴'}
            </button>
            {WEAPONS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelectWeapon(w.slot)}
                className={`rounded px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  hud.weaponSlot === w.slot
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {w.slot}. {w.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
