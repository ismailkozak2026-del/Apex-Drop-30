export type BotAggressionLevel = 'low' | 'normal' | 'hard';
export type BotProfileType = 'rusher' | 'kiter' | 'sniper' | 'scavenger';
export type PlayerStatus = 'active' | 'kicked' | 'banned';
export type DropPhase = 'plane' | 'parachute' | 'ground';

export interface GameConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string;
  twoShotKillEnabled: boolean;
  headshotInstantKillEnabled: boolean;
  doubleJumpJetpackEnabled: boolean;
  startingHp: number;
  startingShield: number;
  zoneShrinkSpeed: number;
  botAggression: BotAggressionLevel;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface PlayerProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  status: PlayerStatus;
  muted: boolean;
  kickReason: string;
  banReason: string;
  online: boolean;
  wins: number;
  kills: number;
  headshots: number;
  matchesPlayed: number;
  totalDamage: number;
  lastSeen?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AdminActionType =
  | 'kick'
  | 'ban'
  | 'unban'
  | 'mute'
  | 'unmute'
  | 'reset_stats'
  | 'delete_player'
  | 'update_config'
  | 'reset_config';

export interface AdminLogEntry {
  id?: string;
  action: AdminActionType;
  targetUid: string;
  targetName: string;
  reason: string;
  details: string;
  adminEmail: string;
  createdAt?: unknown;
}

export type WeaponCategory =
  | 'assault'
  | 'smg'
  | 'shotgun'
  | 'sniper'
  | 'lmg'
  | 'launcher'
  | 'energy'
  | 'pistol';

export interface WeaponSpec {
  id: string;
  slot: number;
  name: string;
  subtitle: string;
  category: WeaponCategory;
  damage: number;
  headshotMultiplier: number;
  fireRateMs: number;
  automatic: boolean;
  burstCount?: number;
  magSize: number;
  reloadMs: number;
  spreadHip: number;
  spreadAds: number;
  recoilKick: number;
  adsFov: number;
  range: number;
  pellets: number;
  projectileType: 'hitscan' | 'rocket' | 'plasma';
  projectileSpeed?: number;
  explosionRadius?: number;
  suppressed?: boolean;
  accentColor: string;
  soundPitch: number;
}

export type HudControlId =
  | 'joystick'
  | 'fireMain'
  | 'fireAds'
  | 'jump'
  | 'reload'
  | 'weaponBar';

export interface HudControlPosition {
  /** Percentage from left edge of viewport (4 - 96) */
  xPct: number;
  /** Percentage from top edge of viewport (8 - 94) */
  yPct: number;
  /** Visual scale (0.6 - 1.6) */
  scale: number;
}

export type HudLayoutPreset = 'default' | 'lefty' | 'claw4';

export interface HudSettings {
  preset: HudLayoutPreset;
  controls: Record<HudControlId, HudControlPosition>;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  victimName: string;
  weaponName: string;
  isHeadshot: boolean;
  killerIsPlayer: boolean;
  victimIsPlayer: boolean;
  timestamp: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  floor: 1 | 2;
  kind: 'bot' | 'crate' | 'car';
}

export interface HouseFootprint {
  x: number;
  z: number;
  w: number;
  d: number;
  name: string;
}

export interface GameHudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  jetpackFuel: number;
  grenades: number;
  maxGrenades: number;
  aliveCount: number;
  totalCount: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  survivalSeconds: number;
  weaponSlot: number;
  ammoInMag: number;
  magSize: number;
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  currentFloor: 1 | 2;
  currentRoom: string;
  zoneRadius: number;
  outsideZone: boolean;
  zoneDps: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  dropPhase: DropPhase;
  altitude: number;
  parachuteOpen: boolean;
  planeProgress: number;
  planeStartX: number;
  planeStartZ: number;
  planeEndX: number;
  planeEndZ: number;
  inVehicle: boolean;
  vehicleName: string;
  vehicleSpeedKmh: number;
  vehicleHp: number;
  vehicleMaxHp: number;
  nearbyVehicleName: string | null;
  houses: HouseFootprint[];
  blips: MinimapBlip[];
  hitMarker: 'none' | 'body' | 'head';
  headCatBannerUntil: number;
  headCatVictim: string;
  killFeed: KillFeedItem[];
}

export interface MatchSummary {
  outcome: 'victory' | 'eliminated';
  placement: number;
  totalCombatants: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  survivalSeconds: number;
  eliminatedBy?: string;
}
